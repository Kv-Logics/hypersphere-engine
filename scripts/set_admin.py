import sqlite3
con = sqlite3.connect("backend/face_attendance.db")
con.execute("UPDATE faculty SET role='admin' WHERE id in ('kv', 'nila', '1', '2')")
con.commit()
print("Updated admin roles for kv, nila, 1, 2")
con.close()
