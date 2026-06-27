import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
  Optional,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { slugify } from '@jewellery/utils';
import type { CreateProductDto } from './dto/create-product.dto';
import type { UpdateProductDto } from './dto/update-product.dto';
import type { QueryProductsDto } from './dto/query-products.dto';
import type { CreateVariantDto } from './dto/product-variant.dto';
import type { ReorderImagesDto } from './dto/reorder-images.dto';
import { ProductSortBy } from './dto/query-products.dto';
import type { SearchService } from '../search/search.service';

const PRODUCT_LIST_SELECT = {
  id: true,
  name: true,
  slug: true,
  basePrice: true,
  discountPct: true,
  attributes: true,
  tags: true,
  isFeatured: true,
  isActive: true,
  createdAt: true,
  category: { select: { id: true, name: true, slug: true } },
  images: {
    where: { isPrimary: true },
    select: { id: true, url: true, publicId: true },
    take: 1,
  },
  variants: {
    select: { id: true, sku: true, price: true, stock: true, size: true, color: true },
  },
  _count: { select: { reviews: true } },
} as const;

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private prisma: PrismaService,
    @Optional() private readonly search: SearchService,
  ) {}

  // ─── Public listing ───────────────────────────────────────────────────────

  async findAll(dto: QueryProductsDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = { isActive: true };

    // Category filter — accept UUID or slug
    if (dto.category) {
      const isUuid = /^[0-9a-f-]{36}$/.test(dto.category);
      const category = await this.prisma.category.findFirst({
        where: isUuid ? { id: dto.category } : { slug: dto.category },
        select: { id: true },
      });
      if (category) where['categoryId'] = category.id;
    }

    // Price range filter using variant prices
    if (dto.minPrice !== undefined || dto.maxPrice !== undefined) {
      where['variants'] = {
        some: {
          price: {
            ...(dto.minPrice !== undefined && { gte: dto.minPrice }),
            ...(dto.maxPrice !== undefined && { lte: dto.maxPrice }),
          },
        },
      };
    }

    // Attribute filters (JSON column — use path filter)
    if (dto.color) {
      (where as Record<string, unknown>)['attributes'] = {
        path: ['color'],
        string_contains: dto.color,
        mode: 'insensitive',
      };
    }

    if (dto.material) {
      (where as Record<string, unknown>)['attributes'] = {
        path: ['material'],
        string_contains: dto.material,
        mode: 'insensitive',
      };
    }

    if (dto.occasion) {
      (where as Record<string, unknown>)['attributes'] = {
        path: ['occasion'],
        string_contains: dto.occasion,
        mode: 'insensitive',
      };
    }

    if (dto.featured) where['isFeatured'] = true;
    if (dto.tag) where['tags'] = { has: dto.tag };

    // Sort
    const orderBy = this.buildOrderBy(dto.sortBy ?? ProductSortBy.NEWEST);

    const [products, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({ where, select: PRODUCT_LIST_SELECT, skip, take: limit, orderBy }),
      this.prisma.product.count({ where }),
    ]);

    return { products, pagination: { page, limit, total } };
  }

  async findBySlug(slug: string) {
    const product = await this.prisma.product.findUnique({
      where: { slug, isActive: true },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] },
        variants: { orderBy: { price: 'asc' } },
        _count: { select: { reviews: true } },
        reviews: {
          where: { isVisible: true },
          take: 3,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            rating: true,
            title: true,
            body: true,
            images: true,
            createdAt: true,
            user: { select: { name: true, avatar: true } },
          },
        },
      },
    });

    if (!product) throw new NotFoundException('Product not found');

    const avgRating =
      product._count.reviews > 0
        ? await this.prisma.review.aggregate({
            where: { productId: product.id, isVisible: true },
            _avg: { rating: true },
          }).then((r) => r._avg.rating ?? 0)
        : 0;

    return { ...product, avgRating: Math.round(avgRating * 10) / 10 };
  }

  // ─── Admin CRUD ───────────────────────────────────────────────────────────

  async adminFindAll(dto: QueryProductsDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {};
    if (dto.category) where['categoryId'] = dto.category;
    if (dto.featured !== undefined) where['isFeatured'] = dto.featured;

    const [products, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        select: PRODUCT_LIST_SELECT,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    return { products, pagination: { page, limit, total } };
  }

  async adminFindOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] },
        variants: { orderBy: { price: 'asc' } },
        _count: { select: { reviews: true } },
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async create(dto: CreateProductDto) {
    const slug = await this.generateUniqueSlug(dto.name);

    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
      select: { id: true },
    });
    if (!category) throw new NotFoundException('Category not found');

    // Check SKU uniqueness upfront
    for (const variant of dto.variants) {
      const existing = await this.prisma.productVariant.findUnique({
        where: { sku: variant.sku },
        select: { id: true },
      });
      if (existing) throw new ConflictException(`SKU '${variant.sku}' already exists`);
    }

    const product = await this.prisma.product.create({
      data: {
        name: dto.name.trim(),
        slug,
        description: dto.description,
        categoryId: dto.categoryId,
        basePrice: dto.basePrice,
        discountPct: dto.discountPct ?? 0,
        attributes: (dto.attributes ?? {}) as Prisma.InputJsonValue,
        tags: dto.tags ?? [],
        metaTitle: dto.metaTitle,
        metaDesc: dto.metaDesc,
        isFeatured: dto.isFeatured ?? false,
        isActive: dto.isActive ?? true,
        variants: {
          create: dto.variants.map((v) => ({
            sku: v.sku.trim().toUpperCase(),
            size: v.size,
            color: v.color,
            price: v.price,
            stock: v.stock,
            weight: v.weight,
          })),
        },
      },
      include: {
        variants: true,
        images: true,
        category: { select: { id: true, name: true, slug: true } },
      },
    });

    this.logger.log(`Product created: ${product.id} (${product.slug})`);
    this.search?.indexProduct(product.id).catch((e) => this.logger.error('Search index after create failed', e));
    return product;
  }

  async update(id: string, dto: UpdateProductDto) {
    const product = await this.findProductOrThrow(id);

    let slug = product.slug;
    if (dto.name && dto.name.trim() !== product.name) {
      slug = await this.generateUniqueSlug(dto.name, id);
    }

    if (dto.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: dto.categoryId },
        select: { id: true },
      });
      if (!category) throw new NotFoundException('Category not found');
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name.trim(), slug }),
        ...(dto.description && { description: dto.description }),
        ...(dto.categoryId && { categoryId: dto.categoryId }),
        ...(dto.basePrice !== undefined && { basePrice: dto.basePrice }),
        ...(dto.discountPct !== undefined && { discountPct: dto.discountPct }),
        ...(dto.attributes && { attributes: dto.attributes as Prisma.InputJsonValue }),
        ...(dto.tags && { tags: dto.tags }),
        ...(dto.metaTitle !== undefined && { metaTitle: dto.metaTitle }),
        ...(dto.metaDesc !== undefined && { metaDesc: dto.metaDesc }),
        ...(dto.isFeatured !== undefined && { isFeatured: dto.isFeatured }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: {
        variants: true,
        images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] },
        category: { select: { id: true, name: true, slug: true } },
      },
    });
    this.search?.indexProduct(id).catch((e) => this.logger.error('Search index after update failed', e));
    return updated;
  }

  async softDelete(id: string) {
    await this.findProductOrThrow(id);
    await this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
    this.search?.indexProduct(id).catch((e) => this.logger.error('Search index after softDelete failed', e));
    return { message: 'Product deactivated' };
  }

  // ─── Variants ─────────────────────────────────────────────────────────────

  async addVariant(productId: string, dto: CreateVariantDto) {
    await this.findProductOrThrow(productId);

    const existing = await this.prisma.productVariant.findUnique({
      where: { sku: dto.sku },
    });
    if (existing) throw new ConflictException(`SKU '${dto.sku}' already exists`);

    const variant = await this.prisma.productVariant.create({
      data: {
        productId,
        sku: dto.sku.trim().toUpperCase(),
        size: dto.size,
        color: dto.color,
        price: dto.price,
        stock: dto.stock,
        weight: dto.weight,
      },
    });
    this.search?.indexProduct(productId).catch((e) => this.logger.error('Search index after addVariant failed', e));
    return variant;
  }

  async updateVariant(productId: string, variantId: string, dto: CreateVariantDto) {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, productId },
    });
    if (!variant) throw new NotFoundException('Variant not found');

    if (dto.sku !== variant.sku) {
      const existing = await this.prisma.productVariant.findUnique({
        where: { sku: dto.sku },
        select: { id: true },
      });
      if (existing && existing.id !== variantId) {
        throw new ConflictException(`SKU '${dto.sku}' already exists`);
      }
    }

    const updated = await this.prisma.productVariant.update({
      where: { id: variantId },
      data: {
        sku: dto.sku.trim().toUpperCase(),
        size: dto.size,
        color: dto.color,
        price: dto.price,
        stock: dto.stock,
        weight: dto.weight,
      },
    });
    this.search?.indexProduct(productId).catch((e) => this.logger.error('Search index after updateVariant failed', e));
    return updated;
  }

  async deleteVariant(productId: string, variantId: string) {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, productId },
    });
    if (!variant) throw new NotFoundException('Variant not found');

    // Don't delete if it's the only variant
    const count = await this.prisma.productVariant.count({ where: { productId } });
    if (count <= 1) {
      throw new BadRequestException('Cannot delete the only variant. Delete the product instead.');
    }

    await this.prisma.productVariant.delete({ where: { id: variantId } });
    this.search?.indexProduct(productId).catch((e) => this.logger.error('Search index after deleteVariant failed', e));
    return { message: 'Variant deleted' };
  }

  // ─── Images ───────────────────────────────────────────────────────────────

  async addImage(productId: string, publicId: string, url: string, isPrimary = false) {
    await this.findProductOrThrow(productId);

    const imageCount = await this.prisma.productImage.count({ where: { productId } });
    if (imageCount >= 10) {
      throw new BadRequestException('Maximum 10 images per product');
    }

    // If this is the first image or isPrimary requested, handle primary logic
    const isFirst = imageCount === 0;
    if (isPrimary || isFirst) {
      await this.prisma.productImage.updateMany({
        where: { productId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const image = await this.prisma.productImage.create({
      data: {
        productId,
        publicId,
        url,
        isPrimary: isPrimary || isFirst,
        sortOrder: imageCount,
      },
    });
    this.search?.indexProduct(productId).catch((e) => this.logger.error('Search index after addImage failed', e));
    return image;
  }

  async removeImage(productId: string, imageId: string) {
    const image = await this.prisma.productImage.findFirst({
      where: { id: imageId, productId },
    });
    if (!image) throw new NotFoundException('Image not found');

    await this.prisma.productImage.delete({ where: { id: imageId } });

    // If deleted image was primary, promote the next one
    if (image.isPrimary) {
      const next = await this.prisma.productImage.findFirst({
        where: { productId },
        orderBy: { sortOrder: 'asc' },
      });
      if (next) {
        await this.prisma.productImage.update({
          where: { id: next.id },
          data: { isPrimary: true },
        });
      }
    }

    this.search?.indexProduct(productId).catch((e) => this.logger.error('Search index after removeImage failed', e));
    return { message: 'Image removed' };
  }

  async reorderImages(productId: string, dto: ReorderImagesDto) {
    await this.findProductOrThrow(productId);

    await this.prisma.$transaction(
      dto.imageIds.map((id, index) =>
        this.prisma.productImage.update({
          where: { id },
          data: { sortOrder: index, isPrimary: index === 0 },
        }),
      ),
    );

    return this.prisma.productImage.findMany({
      where: { productId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  // ─── Cart operations ──────────────────────────────────────────────────────

  async getCart(userId: string) {
    return this.prisma.cartItem.findMany({
      where: { userId },
      include: {
        variant: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                isActive: true,
                images: {
                  where: { isPrimary: true },
                  select: { url: true },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });
  }

  async addToCart(userId: string, variantId: string, quantity: number) {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, product: { isActive: true } },
      select: { id: true, stock: true, price: true },
    });
    if (!variant) throw new NotFoundException('Product variant not found or inactive');
    if (variant.stock < 1) throw new BadRequestException('This item is out of stock');

    const existing = await this.prisma.cartItem.findUnique({
      where: { userId_variantId: { userId, variantId } },
    });

    const newQty = Math.min((existing?.quantity ?? 0) + quantity, variant.stock);

    return this.prisma.cartItem.upsert({
      where: { userId_variantId: { userId, variantId } },
      create: { userId, variantId, quantity: newQty },
      update: { quantity: newQty },
    });
  }

  async updateCartItem(userId: string, variantId: string, quantity: number) {
    if (quantity <= 0) {
      await this.prisma.cartItem.deleteMany({ where: { userId, variantId } });
      return null;
    }

    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      select: { stock: true },
    });
    if (!variant) throw new NotFoundException('Variant not found');

    const safeQty = Math.min(quantity, variant.stock);

    return this.prisma.cartItem.update({
      where: { userId_variantId: { userId, variantId } },
      data: { quantity: safeQty },
    });
  }

  async removeCartItem(userId: string, variantId: string): Promise<void> {
    await this.prisma.cartItem.deleteMany({ where: { userId, variantId } });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  async getImageOrThrow(productId: string, imageId: string) {
    const image = await this.prisma.productImage.findFirst({
      where: { id: imageId, productId },
      select: { id: true, publicId: true, url: true, isPrimary: true },
    });
    if (!image) throw new NotFoundException('Image not found');
    return image;
  }

  async findProductOrThrow(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: { id: true, name: true, slug: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  private async generateUniqueSlug(name: string, excludeId?: string): Promise<string> {
    const base = slugify(name);
    let slug = base;
    let attempt = 0;

    while (true) {
      const existing = await this.prisma.product.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (!existing || existing.id === excludeId) return slug;
      attempt++;
      slug = `${base}-${attempt}`;
    }
  }

  private buildOrderBy(sortBy: ProductSortBy): Prisma.ProductOrderByWithRelationInput {
    switch (sortBy) {
      case ProductSortBy.PRICE_ASC:
        return { basePrice: 'asc' };
      case ProductSortBy.PRICE_DESC:
        return { basePrice: 'desc' };
      case ProductSortBy.POPULAR:
        return { reviews: { _count: 'desc' } };
      case ProductSortBy.FEATURED:
        return { isFeatured: 'desc' };
      case ProductSortBy.NEWEST:
      default:
        return { createdAt: 'desc' };
    }
  }
}
