import { HttpError } from "@assetstore/shared"
import type { Request, Response } from "express";
import {CollectionModel} from "../models/collection.model"

//ownerId, name, description
function validateName(name: unknown): asserts name is string{
    if(typeof name !== "string" || name.length > 100 || name.trim().length === 0) throw new HttpError(400, "Invalid name.")
}
function validateDescription(description: unknown): asserts description is string | undefined{
    if(typeof description === "undefined") return;
    if(typeof description !== "string" || description.length > 2000) throw new HttpError(400, "Invalid description.")
}

export const CollectionController ={
    async create(req: Request, res: Response){
        const name : unknown = req.body?.name;
        const description : unknown = req.body?.description;
        const ownerId = res.locals.userId;
        validateName(name);
        validateDescription(description);

        const collection = await CollectionModel.create({ownerId, name, description})
        return res.status(201).json({
            id: collection.id,
            ownerId: collection.ownerId,
            name: collection.name,
            description: collection.description,
            createdAt: collection.createdAt
        })
    },

    async listByOwner(req: Request, res: Response){
        const ownerId = res.locals.userId;
        const collections = await CollectionModel.listByOwner(ownerId)
        const itemList = collections.map((collection) => ({id: collection.id, ownerId: collection.ownerId, name: collection.name, description: collection.description, createdAt: collection.createdAt}))
        return res.status(200).json({itemList})

    }

}