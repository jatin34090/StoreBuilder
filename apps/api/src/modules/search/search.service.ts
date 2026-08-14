import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'typesense';
import type { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections';
import { PrismaService } from '../../prisma/prisma.service';
import { SearchProductsDto, SearchSortBy } from './dto/search-products.dto';

// ─── Typesense document shape ─────────────────────────────────────────────────

export interface ProductDocument {
  id: string;
  storeId: string;
  name: string;
  slug: string;
  description: string;
  categoryId: string;
  categoryName: string;
  basePrice: number;
  effectivePrice: number;
  discountPct: number;
  isFeatured: boolean;
  isActive: boolean;
  inStock: boolean;
  tags: string[];
  material: string;
  occasion: string;
  color: string;
  finish: string;
  stone: string;
  rating: number;
  reviewCount: number;
  minPrice: number;
  maxStock: number;
  imageUrl: string;
  createdAt: number; // Unix timestamp (seconds)
}

// ─── Collection name & schema ─────────────────────────────────────────────────

const COLLECTION_NAME = 'products';

const COLLECTION_SCHEMA: CollectionCreateSchema = {
  name: COLLECTION_NAME,
  fields: [
    { name: 'id',           type: 'string' },
    { name: 'storeId',      type: 'string', facet: true },
    { name: 'name',         type: 'string' },
    { name: 'slug',         type: 'string',    index: false },
    { name: 'description',  type: 'string' },
    { name: 'categoryId',   type: 'string',    facet: true },
    { name: 'categoryName', type: 'string',    facet: true },
    { name: 'basePrice',    type: 'float',     facet: true },
    { name: 'effectivePrice', type: 'float',   facet: true },
    { name: 'discountPct',  type: 'int32',     facet: true },
    { name: 'isFeatured',   type: 'bool',      facet: true },
    { name: 'isActive',     type: 'bool',      facet: true },
    { name: 'inStock',      type: 'bool',      facet: true },
    { name: 'tags',         type: 'string[]',  facet: true },
    { name: 'material',     type: 'string',    facet: true, optional: true },
    { name: 'occasion',     type: 'string',    facet: true, optional: true },
    { name: 'color',        type: 'string',    facet: true, optional: true },
    { name: 'finish',       type: 'string',    facet: true, optional: true },
    { name: 'stone',        type: 'string',    facet: true, optional: true },
    { name: 'rating',       type: 'float' },
    { name: 'reviewCount',  type: 'int32' },
    { name: 'minPrice',     type: 'float',     facet: true },
    { name: 'maxStock',     type: 'int32' },
    { name: 'imageUrl',     type: 'string',    index: false },
    { name: 'createdAt',    type: 'int64' },
  ] as CollectionCreateSchema['fields'],
  default_sorting_field: 'createdAt',
};

// ─── Sort field mapping ────────────────────────────────────────────────────────

const SORT_MAP: Record<SearchSortBy, string> = {
  [SearchSortBy.NEWEST]:     'createdAt:desc',
  [SearchSortBy.PRICE_ASC]:  'effectivePrice:asc',
  [SearchSortBy.PRICE_DESC]: 'effectivePrice:desc',
  [SearchSortBy.POPULAR]:    'reviewCount:desc,rating:desc',
  [SearchSortBy.RATING]:     'rating:desc,reviewCount:desc',
};

// ─── DB fetch query ───────────────────────────────────────────────────────────

const PRODUCT_FOR_INDEX_INCLUDE = {
  category: { select: { id: true, name: true } },
  images: {
    where: { isPrimary: true },
    select: { url: true },
    take: 1,
  },
  variants: { select: { price: true, stock: true } },
} as const;

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);
  private client: Client | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const host   = this.configService.get<string>('TYPESENSE_HOST', '');
    const apiKey = this.configService.get<string>('TYPESENSE_API_KEY', '');

    if (host && apiKey) {
      this.client = new Client({
        nodes: [
          {
            host,
            port: Number(this.configService.get('TYPESENSE_PORT', '443')),
            protocol: this.configService.get('TYPESENSE_PROTOCOL', 'https'),
          },
        ],
        apiKey,
        connectionTimeoutSeconds: 5,
        retryIntervalSeconds: 0.1,
        numRetries: 3,
      });
    }
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  async onModuleInit() {
    if (!this.client) {
      this.logger.warn('TYPESENSE_HOST not configured — search will use database fallback');
      return;
    }
    await this.ensureCollection();
  }

  // ─── Public: Search ───────────────────────────────────────────────────────

  private readonly DEFAULT_STORE_ID = '00000000-0000-0000-0000-000000000001';

  async search(dto: SearchProductsDto, isAdmin = false, storeId = this.DEFAULT_STORE_ID) {
    const page  = dto.page  ?? 1;
    const limit = dto.limit ?? 20;

    // Resolve categorySlug → categoryId if slug provided instead of UUID
    if (dto.categorySlug && !dto.categoryId) {
      const cat = await this.prisma.category.findFirst({
        where: { slug: dto.categorySlug, storeId },
        select: { id: true },
      });
      if (cat) dto.categoryId = cat.id;
    }

    if (!this.client) {
      return this.dbFallbackSearch(dto, isAdmin, page, limit, storeId);
    }

    // Build filter string
    const filters = this.buildFilters(dto, isAdmin, storeId);
    const sortBy  = SORT_MAP[dto.sortBy ?? SearchSortBy.NEWEST];

    const searchParams = {
      q: dto.q?.trim() || '*',
      query_by: 'name,categoryName,tags,material,occasion,description',
      query_by_weights: '5,3,3,2,2,1',
      filter_by: filters || undefined,
      sort_by: sortBy,
      page,
      per_page: limit,
      facet_by: 'categoryId,categoryName,material,occasion,color,stone,isFeatured,inStock',
      max_facet_values: 20,
      highlight_full_fields: 'name',
      typo_tokens_threshold: 1,
      num_typos: dto.q ? 2 : 0,
    };

    try {
      const response = await this.client
        .collections<ProductDocument>(COLLECTION_NAME)
        .documents()
        .search(searchParams);

      const results = (response.hits ?? []).map((hit) => ({
        ...hit.document,
        highlight: hit.highlights,
      }));

      const facets = this.normalizeFacets(response.facet_counts ?? []);

      return {
        results,
        pagination: {
          page,
          limit,
          total: response.found,
          pageCount: Math.ceil(response.found / limit),
        },
        facets,
      };
    } catch (error) {
      this.logger.error('Typesense search failed — falling back to DB', error);
      return this.dbFallbackSearch(dto, isAdmin, page, limit, storeId);
    }
  }

  // ─── Public: Index Single Product ─────────────────────────────────────────

  /**
   * Fetches fresh product data from DB and upserts into Typesense.
   * Silently logs on failure — never throws — so main DB operations are unaffected.
   */
  async indexProduct(productId: string): Promise<void> {
    if (!this.client) return;
    try {
      const doc = await this.buildDocument(productId);
      if (!doc) {
        this.logger.warn(`indexProduct: product ${productId} not found in DB — skipping`);
        return;
      }
      await this.client
        .collections<ProductDocument>(COLLECTION_NAME)
        .documents()
        .upsert(doc);
      this.logger.debug(`Indexed product ${productId} (${doc.name})`);
    } catch (error) {
      this.logger.error(`Failed to index product ${productId}`, error);
    }
  }

  // ─── Public: Remove Product ───────────────────────────────────────────────

  async removeProduct(productId: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client
        .collections(COLLECTION_NAME)
        .documents(productId)
        .delete();
      this.logger.debug(`Removed product ${productId} from index`);
    } catch (error) {
      this.logger.error(`Failed to remove product ${productId} from index`, error);
    }
  }

  // ─── Admin: Full Reindex ──────────────────────────────────────────────────

  async adminReindex(storeId: string): Promise<{ indexed: number; errors: number; total: number }> {
    if (!this.client) {
      this.logger.warn('adminReindex: Typesense not configured — skipping');
      return { indexed: 0, errors: 0, total: 0 };
    }
    this.logger.log(`Starting Typesense reindex for store ${storeId}...`);

    // Scope to the requesting store's products only
    const products = await this.prisma.product.findMany({
      where: { storeId },
      include: PRODUCT_FOR_INDEX_INCLUDE,
    });

    if (products.length === 0) {
      return { indexed: 0, errors: 0, total: 0 };
    }

    // Build documents
    const docs = await Promise.all(
      products.map(async (p) => {
        try {
          return this.productToDocument(p);
        } catch {
          return null;
        }
      }),
    );

    const validDocs = docs.filter((d): d is ProductDocument => d !== null);

    // Batch upsert — Typesense recommends batches of ≤ 1000
    const BATCH_SIZE = 500;
    let indexed = 0;
    let errors = 0;

    for (let i = 0; i < validDocs.length; i += BATCH_SIZE) {
      const batch = validDocs.slice(i, i + BATCH_SIZE);
      try {
        const results = await this.client
          .collections<ProductDocument>(COLLECTION_NAME)
          .documents()
          .import(batch, { action: 'upsert' });

        for (const result of results) {
          if (result.success) {
            indexed++;
          } else {
            errors++;
            this.logger.warn(`Reindex import error: ${JSON.stringify(result)}`);
          }
        }
      } catch (error) {
        errors += batch.length;
        this.logger.error(`Batch import failed (offset ${i})`, error);
      }
    }

    this.logger.log(`Reindex complete: ${indexed} indexed, ${errors} errors out of ${products.length} products`);
    return { indexed, errors, total: products.length };
  }

  // ─── Private: DB Fallback Search ─────────────────────────────────────────

  private async dbFallbackSearch(dto: SearchProductsDto, isAdmin: boolean, page: number, limit: number, storeId = this.DEFAULT_STORE_ID) {
    const where: Record<string, unknown> = { storeId };
    if (!isAdmin) where['isActive'] = true;
    if (dto.q)          where['name'] = { contains: dto.q, mode: 'insensitive' };
    if (dto.categoryId) where['categoryId'] = dto.categoryId;
    if (dto.isFeatured) where['isFeatured'] = true;

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: { category: true, images: { where: { isPrimary: true }, take: 1 }, variants: true },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    const results = products.map((p) => this.productToDocument(p));
    return {
      results,
      pagination: { page, limit, total, pageCount: Math.ceil(total / limit) },
      facets: {},
    };
  }

  // ─── Private: Collection Setup ────────────────────────────────────────────

  private async ensureCollection(): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.collections(COLLECTION_NAME).retrieve();
      this.logger.log(`Typesense collection "${COLLECTION_NAME}" exists`);
    } catch {
      try {
        await this.client.collections().create(COLLECTION_SCHEMA);
        this.logger.log(`Typesense collection "${COLLECTION_NAME}" created`);
      } catch (createError) {
        this.logger.error('Failed to create Typesense collection — search will be degraded', createError);
      }
    }
  }

  // ─── Private: Document Builder ────────────────────────────────────────────

  private async buildDocument(productId: string): Promise<ProductDocument | null> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { ...PRODUCT_FOR_INDEX_INCLUDE },
    });
    if (!product) return null;
    return this.productToDocument(product);
  }

  private productToDocument(
    product: {
      id: string;
      storeId: string;
      name: string;
      slug: string;
      description: string;
      basePrice: unknown;
      discountPct: number;
      attributes: unknown;
      tags: string[];
      isFeatured: boolean;
      isActive: boolean;
      createdAt: Date;
      category: { id: string; name: string };
      images: { url: string }[];
      variants: { price: unknown; stock: number }[];
    },
  ): ProductDocument {
    const attrs = (product.attributes ?? {}) as Record<string, string>;
    const basePrice = Number(product.basePrice);
    const effectivePrice = basePrice * (1 - product.discountPct / 100);

    const variantPrices = product.variants.map((v) => Number(v.price));
    const minPrice = variantPrices.length > 0 ? Math.min(...variantPrices) : effectivePrice;
    const maxStock  = product.variants.reduce((max, v) => Math.max(max, v.stock), 0);

    return {
      id:             product.id,
      storeId:        product.storeId,
      name:           product.name,
      slug:           product.slug,
      description:    product.description,
      categoryId:     product.category.id,
      categoryName:   product.category.name,
      basePrice:      Math.round(basePrice * 100) / 100,
      effectivePrice: Math.round(effectivePrice * 100) / 100,
      discountPct:    product.discountPct,
      isFeatured:     product.isFeatured,
      isActive:       product.isActive,
      inStock:        maxStock > 0,
      tags:           product.tags,
      material:       attrs['material'] ?? '',
      occasion:       attrs['occasion'] ?? '',
      color:          attrs['color']    ?? '',
      finish:         attrs['finish']   ?? '',
      stone:          attrs['stone']    ?? '',
      rating:         0,       // updated asynchronously via review aggregation
      reviewCount:    0,
      minPrice:       Math.round(minPrice * 100) / 100,
      maxStock,
      imageUrl:       product.images[0]?.url ?? '',
      createdAt:      Math.floor(product.createdAt.getTime() / 1000),
    };
  }

  // ─── Private: Filter Builder ──────────────────────────────────────────────

  private buildFilters(dto: SearchProductsDto, isAdmin: boolean, storeId?: string): string {
    const parts: string[] = [];

    if (storeId) parts.push(`storeId:=${storeId}`);
    // Customers always see only active products
    if (!isAdmin) parts.push('isActive:=true');

    if (dto.categoryId)           parts.push(`categoryId:=${dto.categoryId}`);
    if (dto.minPrice !== undefined) parts.push(`effectivePrice:>=${dto.minPrice}`);
    if (dto.maxPrice !== undefined) parts.push(`effectivePrice:<=${dto.maxPrice}`);
    if (dto.isFeatured === true)  parts.push('isFeatured:=true');
    if (dto.inStock    === true)  parts.push('maxStock:>0');
    if (dto.material)             parts.push(`material:=${dto.material}`);
    if (dto.occasion)             parts.push(`occasion:=${dto.occasion}`);
    if (dto.stone)                parts.push(`stone:=${dto.stone}`);
    if (dto.color)                parts.push(`color:=${dto.color}`);

    return parts.join(' && ');
  }

  // ─── Private: Facet Normalizer ────────────────────────────────────────────

  private normalizeFacets(facetCounts: Array<{ field_name: string; counts: Array<{ value: string; count: number }> }>) {
    const result: Record<string, Array<{ value: string; count: number }>> = {};
    for (const facet of facetCounts) {
      result[facet.field_name] = facet.counts;
    }
    return result;
  }
}
