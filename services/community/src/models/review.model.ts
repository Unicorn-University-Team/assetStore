import { prisma } from "../db/prisma";

export const ReviewModel ={
    async createReview(data: {rating: number, comment: string | undefined, authorId: string, assetId: string}){
        return await prisma.review.create(
            {
                data: {
                    authorId: data.authorId,
                    assetId: data.assetId,
                    comment: data.comment,
                    rating: data.rating
                }
            }
        )

    },

    async getRatingSummary(assetId: string){
        const summary = await prisma.review.aggregate({
            where: {assetId: assetId},
            _avg: {rating: true},
            _count: {rating: true}
        })
        const averageRating = summary._avg.rating;
        const reviewCount = summary._count.rating;
        return {
            averageRating, reviewCount
        }
    }
}