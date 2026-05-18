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

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(private prisma: PrismaService) {}

  // ─── Public ───────────────────────────────────────────────────────────────

  async getTree() {
    // Fetch all active categories in a single query and assemble tree in memory
    const categories = await this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        image: true,
        parentId: true,
        sortOrder: true,
        _count: { select: { products: { where: { isActive: true } } } },
      },
    });

    return this.buildTree(categories);
  }

  async getCategoryBySlug(slug: string) {
    const category = await this.prisma.category.findUnique({
      where: { slug, isActive: true },
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

  // ─── Admin ────────────────────────────────────────────────────────────────

  async adminListAll() {
    return this.prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        parent: { select: { id: true, name: true } },
        _count: { select: { products: true, children: true } },
      },
    });
  }

  async create(dto: CreateCategoryDto) {
    const slug = await this.generateUniqueSlug(dto.name);

    if (dto.parentId) {
      const parent = await this.prisma.category.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent) throw new NotFoundException('Parent category not found');
    }

    return this.prisma.category.create({
      data: {
        name: dto.name.trim(),
        slug,
        image: dto.image,
        parentId: dto.parentId,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const category = await this.findOrThrow(id);

    // If renaming, regenerate slug only if name changed
    let slug = category.slug;
    if (dto.name && dto.name.trim() !== category.name) {
      slug = await this.generateUniqueSlug(dto.name, id);
    }

    // Guard against circular parent reference
    if (dto.parentId && dto.parentId === id) {
      throw new BadRequestException('Category cannot be its own parent');
    }

    if (dto.parentId) {
      const parent = await this.prisma.category.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent) throw new NotFoundException('Parent category not found');

      // Prevent assigning a descendant as parent (circular tree)
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

  async softDelete(id: string) {
    await this.findOrThrow(id);

    // Soft delete: deactivate category and all its children
    const descendantIds = await this.getAllDescendantIds(id);

    await this.prisma.category.updateMany({
      where: { id: { in: [id, ...descendantIds] } },
      data: { isActive: false },
    });

    this.logger.log(`Category ${id} and ${descendantIds.length} descendants deactivated`);
    return { deactivated: descendantIds.length + 1 };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private buildTree(
    categories: Array<{ id: string; name: string; slug: string; image: string | null; parentId: string | null; sortOrder: number; _count: { products: number } }>,
    parentId: string | null = null,
  ): unknown[] {
    return categories
      .filter((c) => c.parentId === parentId)
      .map((c) => ({
        ...c,
        children: this.buildTree(categories, c.id),
      }));
  }

  private async generateUniqueSlug(name: string, excludeId?: string): Promise<string> {
    const base = slugify(name);
    let slug = base;
    let attempt = 0;

    while (true) {
      const existing = await this.prisma.category.findUnique({
        where: { slug },
        select: { id: true },
      });

      if (!existing || existing.id === excludeId) return slug;

      attempt++;
      slug = `${base}-${attempt}`;
    }
  }

  async findById(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      select: { id: true, name: true, slug: true, image: true, isActive: true },
    });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async updateImage(id: string, imageUrl: string): Promise<void> {
    await this.prisma.category.update({ where: { id }, data: { image: imageUrl } });
  }

  private async findOrThrow(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });
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

  private async getAllDescendantIds(categoryId: string): Promise<string[]> {
    const children = await this.prisma.category.findMany({
      where: { parentId: categoryId },
      select: { id: true },
    });

    const ids: string[] = [];
    for (const child of children) {
      ids.push(child.id);
      const nested = await this.getAllDescendantIds(child.id);
      ids.push(...nested);
    }
    return ids;
  }
}
