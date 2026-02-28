import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), "plot_studio.db")

print(f"Connecting to database at {db_path}")
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    cursor.execute("DROP TABLE IF EXISTS scheduled_flows;")
    conn.commit()
    print("Dropped table scheduled_flows successfully.")
except Exception as e:
    print(f"Failed to drop table: {e}")
finally:
    conn.close()
