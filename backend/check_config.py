import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    uri = "mongodb+srv://shingareharshwardhan521_db_user:0OQ3gZQ83rrduPQ1@cluster1.jqup5p7.mongodb.net/?retryWrites=true&w=majority&appName=Cluster1&tlsAllowInvalidCertificates=true"
    client = AsyncIOMotorClient(uri)
    db = client.smart_attendance
    doc = await db.config.find_one({"_id": "global"})
    print(f"Global Config: {doc}")
    if doc and doc.get("geofencing_enabled") is False:
        await db.config.update_one({"_id": "global"}, {"$set": {"geofencing_enabled": True}})
        print("Updated geofencing_enabled to True in DB global config.")

asyncio.run(main())
