import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
	cafes: defineTable({
		name: v.string(),
		slug: v.string(),
		logoUrl: v.optional(v.string()),
	}).index("by_slug", ["slug"]),
	products: defineTable({
		name: v.string(),
		cafeId: v.id("cafes"),
		category: v.string(),
		price: v.optional(v.number()),
		description: v.optional(v.string()),
		calories: v.optional(v.number()),
		imageUrl: v.optional(v.string()),
		isDiscontinued: v.boolean(),
	})
		.index("by_cafe", ["cafeId"])
		.index("by_category", ["category"]),
});
