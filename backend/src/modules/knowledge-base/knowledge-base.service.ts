// src/modules/knowledge-base/knowledge-base.service.ts

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  CreateArticleDto,
  UpdateArticleDto,
  SubmitFeedbackDto,
  RecordUsageDto,
} from './dto';
import { UserRole } from '@prisma/client';

// Role rank — higher number = higher privilege
const ROLE_RANK: Record<UserRole, number> = {
  READ_ONLY: 1,
  END_USER: 2,
  TECHNICIAN: 3,
  SUPERVISOR: 4,
  FINANCE_ADMIN: 5,
  HELP_DESK: 6,
  IT_MANAGER: 7,
  SUPER_ADMIN: 8,
};

/**
 * Returns all UserRole values that have rank <= the given role's rank.
 * An article tagged [TECHNICIAN] is visible to TECHNICIAN, SUPERVISOR, … SUPER_ADMIN.
 * A user at rank N can see articles whose minimum tagged role has rank <= N.
 * We pass the "accessible roles" (rank <= userRank) so Prisma hasSome works correctly.
 */
function getAccessibleRoles(userRole: UserRole): UserRole[] {
  const userRank = ROLE_RANK[userRole] ?? 0;
  return (Object.keys(ROLE_RANK) as UserRole[]).filter(
    (r) => ROLE_RANK[r] <= userRank,
  );
}

/** Prisma where clause to filter by role visibility */
function visibilityFilter(userRole: UserRole) {
  const accessible = getAccessibleRoles(userRole);
  return {
    OR: [
      { visibleToRoles: { isEmpty: true } },
      { visibleToRoles: { hasSome: accessible } },
    ],
  };
}

@Injectable()
export class KnowledgeBaseService {
  constructor(private readonly prisma: PrismaService) {}

  // ==========================================
  // CATEGORY METHODS
  // ==========================================

  /**
   * Generate slug from name
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  /**
   * Create category
   */
  async createCategory(dto: CreateCategoryDto) {
    const slug = dto.slug || this.generateSlug(dto.name);

    // Check slug uniqueness
    const existing = await this.prisma.knowledgeCategory.findUnique({
      where: { slug },
    });

    if (existing) {
      throw new ConflictException(`Slug "${slug}" already exists`);
    }

    return this.prisma.knowledgeCategory.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        icon: dto.icon,
        color: dto.color,
        parentId: dto.parentId,
        sortOrder: dto.sortOrder || 0,
      },
      include: {
        parent: true,
        _count: { select: { articles: true, children: true } },
      },
    });
  }

  /**
   * Get all categories
   */
  async getCategories(includeInactive = false) {
    const where = includeInactive ? {} : { isActive: true };

    const categories = await this.prisma.knowledgeCategory.findMany({
      where,
      include: {
        parent: {
          select: { id: true, name: true, slug: true },
        },
        _count: { select: { articles: true, children: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    // Build tree structure
    const categoryMap = new Map();
    const rootCategories: any[] = [];

    categories.forEach((cat) => {
      categoryMap.set(cat.id, { ...cat, children: [] });
    });

    categories.forEach((cat) => {
      const catWithChildren = categoryMap.get(cat.id);
      if (cat.parentId) {
        const parent = categoryMap.get(cat.parentId);
        if (parent) {
          parent.children.push(catWithChildren);
        }
      } else {
        rootCategories.push(catWithChildren);
      }
    });

    return {
      flat: categories,
      tree: rootCategories,
    };
  }

  /**
   * Get category by ID or slug
   */
  async getCategory(idOrSlug: string) {
    const isNumeric = /^\d+$/.test(idOrSlug);

    const category = await this.prisma.knowledgeCategory.findFirst({
      where: isNumeric
        ? { id: parseInt(idOrSlug) }
        : { slug: idOrSlug },
      include: {
        parent: true,
        children: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
        articles: {
          where: { isPublished: true },
          select: {
            id: true,
            title: true,
            slug: true,
            summary: true,
            viewCount: true,
            helpfulCount: true,
            createdAt: true,
          },
          orderBy: { viewCount: 'desc' },
          take: 10,
        },
        _count: { select: { articles: true } },
      },
    });

    if (!category) {
      throw new NotFoundException(`Category not found: ${idOrSlug}`);
    }

    return category;
  }

  /**
   * Update category
   */
  async updateCategory(id: number, dto: UpdateCategoryDto) {
    const category = await this.prisma.knowledgeCategory.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException(`Category not found: ${id}`);
    }

    return this.prisma.knowledgeCategory.update({
      where: { id },
      data: dto,
      include: {
        parent: true,
        _count: { select: { articles: true, children: true } },
      },
    });
  }

  /**
   * Delete category
   */
  async deleteCategory(id: number) {
    const category = await this.prisma.knowledgeCategory.findUnique({
      where: { id },
      include: {
        _count: { select: { articles: true, children: true } },
      },
    });

    if (!category) {
      throw new NotFoundException(`Category not found: ${id}`);
    }

    if (category._count.articles > 0 || category._count.children > 0) {
      throw new BadRequestException(
        'Cannot delete category with articles or subcategories',
      );
    }

    return this.prisma.knowledgeCategory.delete({
      where: { id },
    });
  }

  // ==========================================
  // ARTICLE METHODS
  // ==========================================

  /**
   * Create article
   */
  async createArticle(authorId: number, dto: CreateArticleDto) {
    const slug = dto.slug || this.generateSlug(dto.title);

    // Check slug uniqueness
    const existing = await this.prisma.knowledgeArticle.findUnique({
      where: { slug },
    });

    if (existing) {
      throw new ConflictException(`Slug "${slug}" already exists`);
    }

    // Verify category exists
    const category = await this.prisma.knowledgeCategory.findUnique({
      where: { id: dto.categoryId },
    });

    if (!category) {
      throw new NotFoundException(`Category not found: ${dto.categoryId}`);
    }

    return this.prisma.knowledgeArticle.create({
      data: {
        categoryId: dto.categoryId,
        title: dto.title,
        slug,
        summary: dto.summary,
        content: dto.content,
        keywords: dto.keywords || [],
        isPublic: dto.isPublic ?? true,
        isPublished: dto.isPublished ?? false,
        publishedAt: dto.isPublished ? new Date() : null,
        authorId,
        relatedArticleIds: dto.relatedArticleIds || [],
        attachments: dto.attachments || [],
        visibleToRoles: dto.visibleToRoles || [],
      },
      include: {
        category: true,
        author: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  /**
   * Get all articles (filtered by user's role)
   */
  async getArticles(
    userRole: UserRole,
    query?: {
      page?: number;
      limit?: number;
      categoryId?: number;
      search?: string;
      isPublished?: boolean;
      authorId?: number;
      roleFilter?: string; // 'ALL' | UserRole — filter by target audience
    },
  ) {
    const page = query?.page || 1;
    const limit = query?.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { AND: [visibilityFilter(userRole)] };

    // Role filter: 'ALL' = articles for everyone; '<ROLE>' = articles tagged for that role
    if (query?.roleFilter === 'ALL') {
      where.AND.push({ visibleToRoles: { isEmpty: true } });
    } else if (query?.roleFilter) {
      where.AND.push({ visibleToRoles: { has: query.roleFilter as UserRole } });
    }

    if (query?.categoryId) {
      where.AND.push({ categoryId: query.categoryId });
    }

    if (query?.isPublished !== undefined) {
      where.AND.push({ isPublished: query.isPublished });
    }

    if (query?.authorId) {
      where.AND.push({ authorId: query.authorId });
    }

    if (query?.search) {
      where.AND.push({
        OR: [
          { title: { contains: query.search, mode: 'insensitive' } },
          { summary: { contains: query.search, mode: 'insensitive' } },
          { content: { contains: query.search, mode: 'insensitive' } },
          { keywords: { has: query.search.toLowerCase() } },
        ],
      });
    }

    const [articles, total] = await Promise.all([
      this.prisma.knowledgeArticle.findMany({
        where,
        include: {
          category: {
            select: { id: true, name: true, slug: true },
          },
          author: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: [
          { isPublished: 'desc' },
          { viewCount: 'desc' },
          { createdAt: 'desc' },
        ],
        skip,
        take: limit,
      }),
      this.prisma.knowledgeArticle.count({ where }),
    ]);

    return {
      data: articles,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Search articles (full-text, filtered by role)
   */
  async searchArticles(userRole: UserRole, query: string, limit = 10) {
    const articles = await this.prisma.knowledgeArticle.findMany({
      where: {
        isPublished: true,
        AND: [
          visibilityFilter(userRole),
          {
            OR: [
              { title: { contains: query, mode: 'insensitive' } },
              { summary: { contains: query, mode: 'insensitive' } },
              { content: { contains: query, mode: 'insensitive' } },
              { keywords: { has: query.toLowerCase() } },
            ],
          },
        ],
      },
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
      },
      orderBy: [{ helpfulCount: 'desc' }, { viewCount: 'desc' }],
      take: limit,
    });

    return articles;
  }

  /**
   * Get popular articles (filtered by role)
   */
  async getPopularArticles(userRole: UserRole, limit = 10) {
    return this.prisma.knowledgeArticle.findMany({
      where: { isPublished: true, AND: [visibilityFilter(userRole)] },
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
      },
      orderBy: [{ viewCount: 'desc' }, { helpfulCount: 'desc' }],
      take: limit,
    });
  }

  /**
   * Get article by ID or slug
   */
  async getArticle(idOrSlug: string, incrementView = false) {
    const isNumeric = /^\d+$/.test(idOrSlug);

    const article = await this.prisma.knowledgeArticle.findFirst({
      where: isNumeric
        ? { id: parseInt(idOrSlug) }
        : { slug: idOrSlug },
      include: {
        category: true,
        author: {
          select: { id: true, firstName: true, lastName: true },
        },
        lastEditedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        feedbacks: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
        _count: { select: { feedbacks: true, usageHistory: true } },
      },
    });

    if (!article) {
      throw new NotFoundException(`Article not found: ${idOrSlug}`);
    }

    // Increment view count
    if (incrementView) {
      await this.prisma.knowledgeArticle.update({
        where: { id: article.id },
        data: { viewCount: { increment: 1 } },
      });
    }

    // Get related articles
    const relatedArticles = article.relatedArticleIds.length > 0
      ? await this.prisma.knowledgeArticle.findMany({
          where: {
            id: { in: article.relatedArticleIds },
            isPublished: true,
          },
          select: {
            id: true,
            title: true,
            slug: true,
            summary: true,
          },
        })
      : [];

    return {
      ...article,
      relatedArticles,
    };
  }

  /**
   * Update article
   */
  async updateArticle(id: number, editorId: number, dto: UpdateArticleDto) {
    const article = await this.prisma.knowledgeArticle.findUnique({
      where: { id },
    });

    if (!article) {
      throw new NotFoundException(`Article not found: ${id}`);
    }

    const wasPublished = article.isPublished;
    const nowPublished = dto.isPublished ?? wasPublished;

    return this.prisma.knowledgeArticle.update({
      where: { id },
      data: {
        ...dto,
        lastEditedById: editorId,
        version: { increment: 1 },
        publishedAt:
          !wasPublished && nowPublished ? new Date() : article.publishedAt,
      },
      include: {
        category: true,
        author: {
          select: { id: true, firstName: true, lastName: true },
        },
        lastEditedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  /**
   * Publish/Unpublish article
   */
  async togglePublish(id: number, isPublished: boolean) {
    const article = await this.prisma.knowledgeArticle.findUnique({
      where: { id },
    });

    if (!article) {
      throw new NotFoundException(`Article not found: ${id}`);
    }

    return this.prisma.knowledgeArticle.update({
      where: { id },
      data: {
        isPublished,
        publishedAt: isPublished ? new Date() : null,
      },
    });
  }

  /**
   * Delete article
   */
  async deleteArticle(id: number) {
    const article = await this.prisma.knowledgeArticle.findUnique({
      where: { id },
    });

    if (!article) {
      throw new NotFoundException(`Article not found: ${id}`);
    }

    return this.prisma.knowledgeArticle.delete({
      where: { id },
    });
  }

  // ==========================================
  // FEEDBACK METHODS
  // ==========================================

  /**
   * Submit feedback for article
   */
  async submitFeedback(articleId: number, userId: number, dto: SubmitFeedbackDto) {
    const article = await this.prisma.knowledgeArticle.findUnique({
      where: { id: articleId },
    });

    if (!article) {
      throw new NotFoundException(`Article not found: ${articleId}`);
    }

    // Check if user already submitted feedback
    const existing = await this.prisma.knowledgeArticleFeedback.findUnique({
      where: {
        articleId_userId: { articleId, userId },
      },
    });

    if (existing) {
      // Update existing feedback
      const oldHelpful = existing.isHelpful;

      await this.prisma.knowledgeArticleFeedback.update({
        where: { id: existing.id },
        data: {
          isHelpful: dto.isHelpful,
          comment: dto.comment,
        },
      });

      // Update counts
      if (oldHelpful !== dto.isHelpful) {
        await this.prisma.knowledgeArticle.update({
          where: { id: articleId },
          data: {
            helpfulCount: dto.isHelpful ? { increment: 1 } : { decrement: 1 },
            notHelpfulCount: dto.isHelpful ? { decrement: 1 } : { increment: 1 },
          },
        });
      }

      return { message: 'Feedback updated' };
    }

    // Create new feedback
    await this.prisma.knowledgeArticleFeedback.create({
      data: {
        articleId,
        userId,
        isHelpful: dto.isHelpful,
        comment: dto.comment,
      },
    });

    // Update counts
    await this.prisma.knowledgeArticle.update({
      where: { id: articleId },
      data: dto.isHelpful
        ? { helpfulCount: { increment: 1 } }
        : { notHelpfulCount: { increment: 1 } },
    });

    return { message: 'Feedback submitted' };
  }

  // ==========================================
  // USAGE TRACKING
  // ==========================================

  /**
   * Record article usage
   */
  async recordUsage(articleId: number, userId: number, dto: RecordUsageDto) {
    const article = await this.prisma.knowledgeArticle.findUnique({
      where: { id: articleId },
    });

    if (!article) {
      throw new NotFoundException(`Article not found: ${articleId}`);
    }

    return this.prisma.knowledgeArticleUsage.create({
      data: {
        articleId,
        usedById: userId,
        incidentId: dto.incidentId,
        usageType: dto.usageType,
        notes: dto.notes,
      },
    });
  }

  /**
   * Get article usage stats
   */
  async getArticleUsageStats(articleId: number) {
    const [usageByType, recentUsage] = await Promise.all([
      this.prisma.knowledgeArticleUsage.groupBy({
        by: ['usageType'],
        where: { articleId },
        _count: { id: true },
      }),
      this.prisma.knowledgeArticleUsage.findMany({
        where: { articleId },
        include: {
          usedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
          incident: {
            select: { id: true, ticketNumber: true, title: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    return {
      usageByType: Object.fromEntries(
        usageByType.map((u) => [u.usageType, u._count.id]),
      ),
      recentUsage,
    };
  }

  // ==========================================
  // STATISTICS
  // ==========================================

  /**
   * Get KB statistics
   */
  async getStats() {
    const [
      totalCategories,
      totalArticles,
      publishedArticles,
      totalViews,
      totalHelpful,
      totalUsages,
      topArticles,
      topCategories,
    ] = await Promise.all([
      this.prisma.knowledgeCategory.count({ where: { isActive: true } }),
      this.prisma.knowledgeArticle.count(),
      this.prisma.knowledgeArticle.count({ where: { isPublished: true } }),
      this.prisma.knowledgeArticle.aggregate({ _sum: { viewCount: true } }),
      this.prisma.knowledgeArticle.aggregate({ _sum: { helpfulCount: true } }),
      this.prisma.knowledgeArticleUsage.count(),
      this.prisma.knowledgeArticle.findMany({
        where: { isPublished: true },
        select: { id: true, title: true, slug: true, viewCount: true, helpfulCount: true },
        orderBy: { viewCount: 'desc' },
        take: 5,
      }),
      this.prisma.knowledgeCategory.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          slug: true,
          _count: { select: { articles: true } },
        },
        orderBy: { articles: { _count: 'desc' } },
        take: 5,
      }),
    ]);

    return {
      totalCategories,
      totalArticles,
      publishedArticles,
      draftArticles: totalArticles - publishedArticles,
      totalViews: totalViews._sum.viewCount || 0,
      totalHelpful: totalHelpful._sum.helpfulCount || 0,
      totalUsages,
      topArticles,
      topCategories,
    };
  }

  /**
   * Get suggested articles for incident (filtered by role)
   */
  async getSuggestedArticles(
    userRole: UserRole,
    incidentCategory: string,
    keywords: string[],
  ) {
    const articles = await this.prisma.knowledgeArticle.findMany({
      where: {
        isPublished: true,
        AND: [
          visibilityFilter(userRole),
          {
            OR: [
              { category: { name: { contains: incidentCategory, mode: 'insensitive' } } },
              { keywords: { hasSome: keywords.map((k) => k.toLowerCase()) } },
              { title: { contains: incidentCategory, mode: 'insensitive' } },
            ],
          },
        ],
      },
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
      },
      orderBy: [{ helpfulCount: 'desc' }, { viewCount: 'desc' }],
      take: 5,
    });

    return articles;
  }
}
