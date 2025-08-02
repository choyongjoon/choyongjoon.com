import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  cafes: defineTable({
    name: v.string(),
    slug: v.string(),
    imageStorageId: v.optional(v.id('_storage')),
    rank: v.optional(v.number()),
  }).index('by_slug', ['slug']),
  products: defineTable({
    cafeId: v.id('cafes'),
    name: v.string(),
    nameEn: v.optional(v.string()),
    category: v.optional(v.string()),
    externalCategory: v.optional(v.string()),
    description: v.optional(v.string()),
    externalImageUrl: v.optional(v.string()),
    imageStorageId: v.optional(v.id('_storage')),
    externalId: v.string(),
    externalUrl: v.string(),
    price: v.optional(v.number()),
    addedAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_cafe', ['cafeId'])
    .index('by_category', ['category'])
    .index('by_external_id', ['externalId']),
});
