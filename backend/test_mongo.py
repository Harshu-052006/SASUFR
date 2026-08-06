import sys
if sys.platform == 'win32':
    try:
        import dns.win32util
        dns.win32util.set_config_method(dns.win32util.ConfigMethod.Registry)
    except Exception:
        pass

import asyncio
import motor.motor_asyncio

async def main():
    client = motor.motor_asyncio.AsyncIOMotorClient(
        'mongodb+srv://shingareharshwardhan521_db_user:0OQ3gZQ83rrduPQ1@cluster1.jqup5p7.mongodb.net/?retryWrites=true&w=majority&appName=Cluster1',
        tlsAllowInvalidCertificates=True
    )
    print("PING RESULT:", await client.admin.command('ping'))

if __name__ == '__main__':
    asyncio.run(main())
