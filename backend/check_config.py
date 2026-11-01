import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    uri = "mongodb+srv://shingareharshwardhan521_db_user:0OQ3gZQ83rrduPQ1@cluster1.jqup5p7.mongodb.net/?retryWrites=true&w=majority&appName=Cluster1&tlsAllowInvalidCertificates=true"
    client = AsyncIOMotorClient(uri)
    db = client.smart_attendance
    doc = await db.config.find_one({"_id": "global"})
    print(f"Global Config: {doc}")
    await db.config.update_one({"_id": "global"}, {"$set": {"geofencing_enabled": False}}, upsert=True)
    doc = await db.config.find_one({"_id": "global"})
    print(f"Updated Global Config: {doc}")

asyncio.run(main())
