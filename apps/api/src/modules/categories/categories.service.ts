import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { slugify } from '@jewellery/utils';
import type { CreateCategoryDto } from './dto/create-category.dto';
import type { UpdateCategoryDto } from './dto/update-category.dto';

const DEFAULT_STORE_ID = '00000000-0000-0000-0000-000000000001';

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(private prisma: PrismaService) {}

  // ─── Public (storefront) — always scoped to a specific store ──────────────

  async getTree(storeId = DEFAULT_STORE_ID) {
    const categories = await this.prisma.category.findMany({
      where: { storeId, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        image: true,
        parentId: true,
        sortOrder: true,
        _count: { select: { products: { where: { isActive: true, storeId } } } },
      },
    });

    return this.buildTree(categories);
  }

  async getCategoryBySlug(slug: string, storeId = DEFAULT_STORE_ID) {
    const category = await this.prisma.category.findFirst({
      where: { storeId, slug, isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        image: true,
        parentId: true,
        parent: { select: { id: true, name: true, slug: true } },
        children: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          select: { id: true, name: true, slug: true, image: true },
        },
      },
    });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  // ─── Admin — always scoped to the caller's store ──────────────────────────

  async adminListAll(storeId = DEFAULT_STORE_ID) {
    return this.prisma.category.findMany({
      where: { storeId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        parent: { select: { id: true, name: true } },
        _count: { select: { products: true, children: true } },
      },
    });
  }

  async create(dto: CreateCategoryDto, storeId = DEFAULT_STORE_ID) {
    const slug = await this.generateUniqueSlug(dto.name, storeId);

    if (dto.parentId) {
      const parent = await this.prisma.category.findFirst({
        where: { id: dto.parentId, storeId },
      });
      if (!parent) throw new NotFoundException('Parent category not found');
    }

    return this.prisma.category.create({
      data: {
        storeId,
        name: dto.name.trim(),
        slug,
        image: dto.image,
        parentId: dto.parentId,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async update(id: string, dto: UpdateCategoryDto, storeId = DEFAULT_STORE_ID) {
    const category = await this.findOrThrow(id, storeId);

    let slug = category.slug;
    if (dto.name && dto.name.trim() !== category.name) {
      slug = await this.generateUniqueSlug(dto.name, storeId, id);
    }

    if (dto.parentId && dto.parentId === id) {
      throw new BadRequestException('Category cannot be its own parent');
    }

    if (dto.parentId) {
      const parent = await this.prisma.category.findFirst({
        where: { id: dto.parentId, storeId },
      });
      if (!parent) throw new NotFoundException('Parent category not found');

      const isDescendant = await this.isDescendant(dto.parentId, id);
      if (isDescendant) {
        throw new BadRequestException('Cannot assign a child category as parent (circular reference)');
      }
    }

    return this.prisma.category.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name.trim(), slug }),
        ...(dto.image !== undefined && { image: dto.image }),
        ...(dto.parentId !== undefined && { parentId: dto.parentId }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
    });
  }

  async delete(id: string, storeId = DEFAULT_STORE_ID) {
    await this.findOrThrow(id, storeId);

    const descendantIds = await this.getAllDescendantIds(id, storeId);
    const allIds = [id, ...descendantIds];

    const productCount = await this.prisma.product.count({
      where: { storeId, categoryId: { in: allIds } },
    });

    if (productCount > 0) {
      throw new BadRequestException(
        `Cannot delete: ${productCount} product(s) are assigned to this category or its sub-categories. Reassign them first.`,
      );
    }

    await this.prisma.category.deleteMany({ where: { id: { in: descendantIds }, storeId } });
    await this.prisma.category.delete({ where: { id } });

    this.logger.log(`Category ${id} and ${descendantIds.length} descendants deleted`);
    return { deleted: allIds.length };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private buildTree(
    categories: Array<{ id: string; name: string; slug: string; image: string | null; parentId: string | null; sortOrder: number; _count: { products: number } }>,
    parentId: string | null = null,
  ): unknown[] {
    return categories
      .filter((c) => c.parentId === parentId)
      .map((c) => ({ ...c, children: this.buildTree(categories, c.id) }));
  }

  private async generateUniqueSlug(name: string, storeId: string, excludeId?: string): Promise<string> {
    const base = slugify(name);
    let slug = base;
    let attempt = 0;

    while (true) {
      const existing = await this.prisma.category.findFirst({
        where: { storeId, slug },
        select: { id: true },
      });

      if (!existing || existing.id === excludeId) return slug;

      attempt++;
      slug = `${base}-${attempt}`;
    }
  }

  async findById(id: string, storeId?: string) {
    const where = storeId ? { id, storeId } : { id };
    const category = await this.prisma.category.findFirst({
      where,
      select: { id: true, name: true, slug: true, image: true, isActive: true, storeId: true },
    });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async updateImage(id: string, imageUrl: string): Promise<void> {
    await this.prisma.category.update({ where: { id }, data: { image: imageUrl } });
  }

  private async findOrThrow(id: string, storeId: string) {
    const category = await this.prisma.category.findFirst({ where: { id, storeId } });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  private async isDescendant(potentialDescendantId: string, ancestorId: string): Promise<boolean> {
    const category = await this.prisma.category.findUnique({
      where: { id: potentialDescendantId },
      select: { parentId: true },
    });
    if (!category || !category.parentId) return false;
    if (category.parentId === ancestorId) return true;
    return this.isDescendant(category.parentId, ancestorId);
  }

  private async getAllDescendantIds(categoryId: string, storeId: string): Promise<string[]> {
    const children = await this.prisma.category.findMany({
      where: { parentId: categoryId, storeId },
      select: { id: true },
    });

    const ids: string[] = [];
    for (const child of children) {
      ids.push(child.id);
      const nested = await this.getAllDescendantIds(child.id, storeId);
      ids.push(...nested);
    }
    return ids;
  }
}
