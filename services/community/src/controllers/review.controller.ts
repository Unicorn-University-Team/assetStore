import { HttpError } from "@assetstore/shared"
import { Request, Response } from "express"
import { CatalogClient } from "../clients/catalog.client";
import { ReviewModel } from "../models/review.model";
import {IdentityClient} from "../clients/identity.client"
import { Prisma } from "../generated/prisma/client";


// const authorId = res.locals.userId
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validateAssetId(assetId: string | undefined | string[]) : asserts assetId is string {
    if (typeof assetId !== "string" || !UUID.test(assetId)) {
        throw new HttpError(400, "Invalid asset ID.");
    }
}

async function ensureReviewAllowed(assetId: string, authorId: string) {  

   const assets = await CatalogClient.assetSummaries([assetId])
   const asset = assets.get(assetId)

    if(!asset) throw new HttpError(404, "No asset found.")

    const ownerId = asset.ownerId;
    if(authorId === ownerId) throw new HttpError(403, "Forbidden to write a review.")
 }

function validateRating(rating: unknown): asserts rating is number {
   if(typeof rating !== "number"||!Number.isInteger(rating)) throw new HttpError(400, "Invalid rating type.")
    if(rating > 5 || rating < 1) throw new HttpError(400, "Invalid rating.")
 }

function validateComment(comment: unknown): asserts comment is string | undefined{
    if(typeof comment !== "string" && typeof comment !== "undefined") throw new HttpError(400, "Invalid comment type.")
    if(typeof comment === "string" && comment.length > 2000) throw new HttpError(400, "Too long comment.")
    }


export const ReviewController = {
    async create(req: Request, res: Response){
 
        const assetId = req.params.assetId;
        const authorId = res.locals.userId;
        const rating : unknown = req.body?.rating;
        const comment : unknown = req.body?.comment;
        validateAssetId(assetId);
        validateRating(rating);
        validateComment(comment);
        await ensureReviewAllowed(assetId, authorId);
        
   try{
        const review = await ReviewModel.createReview({rating, comment, authorId, assetId});
        const ratingSummary = await ReviewModel.getRatingSummary(assetId);

        const usernames = await IdentityClient.usernames([authorId]); // returns an entire Map (key - value)
        const authorName = usernames.get(authorId) ?? null; // returns specific value (authorName)

        return res.status(201).json({
            id: review.id,
            assetId: review.assetId,
            authorId: review.authorId,
            authorName: authorName,
            rating: review.rating,
            comment: review.comment,
            createdAt: review.createdAt,
            averageRating: ratingSummary.averageRating
        })
    }
    catch (error){
        if ( error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" )
        {
            throw new HttpError(409, "User has already reviewed this asset.");
        }
        throw error;
        }
  
    }
}
