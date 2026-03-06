import { defineCollection, z } from "astro:content";

const products = defineCollection({
	schema: ({ image }) => z.object({
		title: z.string(),
		description: z.string(),
		image: image().optional(),
		presentations: z.array(z.string())
	})
});

export const collections = { products };
