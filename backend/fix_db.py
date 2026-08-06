import asyncio
import re
from app.database.mongo import get_database

async def remove_user():
    db = await get_database()
    email_pattern = re.compile("^kiranmangala2002@gmail.com$", re.IGNORECASE)
    
    # Find the user(s) first to print info and get their ID
    users = await db.users.find({"email": email_pattern}).to_list(length=None)
    
    if not users:
        print("No user found with email 'kiranmangala2002@gmail.com'")
        return
        
    for user in users:
        user_id = user.get("id")
        email = user.get("email")
        role = user.get("role")
        name = user.get("full_name")
        
        print(f"Found user: ID={user_id}, Name='{name}', Email='{email}', Role='{role}'")
        
        # Delete user
        del_user_res = await db.users.delete_one({"id": user_id})
        print(f"Deleted user doc: {del_user_res.deleted_count}")
        
        # Delete user's attendance records
        del_att_res = await db.attendance.delete_many({"user_id": user_id})
        print(f"Deleted student attendance records: {del_att_res.deleted_count}")
        
        # Also clean up marked_by_user_id references if any
        del_marker_res = await db.attendance.delete_many({"marked_by_user_id": user_id})
        print(f"Deleted attendance records marked by this user: {del_marker_res.deleted_count}")
        
        # Clean up claims / absent notifications if any
        # (Assuming they might reference user or name, let's keep database clean)
        
    print("User and associated records permanently deleted successfully.")

if __name__ == "__main__":
    asyncio.run(remove_user())
