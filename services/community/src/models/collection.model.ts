import { prisma } from "../db/prisma"

export const CollectionModel ={

         async create(data: {ownerId: string, name: string, description?: string}){
          return await prisma.collection.create({
                data:{
                    ownerId: data.ownerId,
                    name: data.name,
                    description: data.description,
                }
            })
        },

        async listByOwner(ownerId: string){
            return await prisma.collection.findMany({
                where: {ownerId}
            })
        }
}
