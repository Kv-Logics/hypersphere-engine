import os
import csv
import logging
from app.db.database import database, faculty

logger = logging.getLogger(__name__)

def extract_username(email: str) -> str:
    if not email:
        return ""
    email = email.strip().lower()
    if "@" in email:
        return email.split("@")[0]
    return email

async def seed_users_from_csv(project_root: str):
    logger.info("Starting CSV user seeding process...")
    data_dir = os.path.join(project_root, "Data_Of_Users")
    if not os.path.exists(data_dir):
        logger.error(f"Data directory {data_dir} does not exist. Skipping seeding.")
        return

    csv_files = {
        "Faculty.csv": "faculty",
        "Hods.csv": "hod",
        "Deans.csv": "dean",
        "Director and Registrar.csv": "director_registrar"
    }

    total_inserted = 0
    total_skipped = 0

    for filename, designation in csv_files.items():
        file_path = os.path.join(data_dir, filename)
        if not os.path.exists(file_path):
            logger.warning(f"CSV file not found: {file_path}")
            continue

        logger.info(f"Processing {filename}...")
        try:
            # Open file handling potential Byte Order Mark (BOM)
            with open(file_path, mode="r", encoding="utf-8-sig") as f:
                # Clean headers of whitespace or invisible characters
                reader = csv.reader(f)
                headers = [h.strip().replace('"', '') for h in next(reader)]
                
                # Create a DictReader with cleaned headers
                rows = []
                for row_data in reader:
                    if not row_data:
                        continue
                    # Pad row if columns are missing
                    if len(row_data) < len(headers):
                        row_data += [""] * (len(headers) - len(row_data))
                    rows.append(dict(zip(headers, row_data)))

                for row in rows:
                    # Normalize fields depending on the CSV layout
                    email = ""
                    name = ""
                    emp_id = None
                    dept = None
                    dest = designation

                    # Check headers
                    if "emp_email" in row:
                        email = row["emp_email"].strip()
                    elif "Email" in row:
                        email = row["Email"].strip()
                    elif "email" in row:
                        email = row["email"].strip()

                    if "emp_name" in row:
                        name = row["emp_name"].strip()
                    elif "Name" in row:
                        name = row["Name"].strip()
                    elif "Name " in row:
                        name = row["Name "].strip()

                    if "emp_id" in row:
                        emp_id = row["emp_id"].strip()

                    # Department
                    if "Department" in row:
                        dept = row["Department"].strip()
                    elif "department" in row:
                        dept = row["department"].strip()

                    # Resolve director vs registrar
                    if designation == "director_registrar":
                        if "registrar" in email.lower() or "registrar" in name.lower():
                            dest = "registrar"
                        else:
                            dest = "director"

                    username = extract_username(email)
                    if not username or not name:
                        continue

                    # Check if user already exists
                    check_query = faculty.select().where(faculty.c.id == username)
                    existing_user = await database.fetch_one(check_query)

                    if not existing_user:
                        # Set default roles: e.g. director, registrar, hods, deans could be admins,
                        # or keep them as user and configure role dynamically
                        role = "user"
                        if dest in ["director", "registrar"]:
                            role = "admin" # Auto promote top admins

                        insert_query = faculty.insert().values(
                            id=username,
                            name=name,
                            email=email,
                            role=role,
                            emp_id=emp_id,
                            department=dept,
                            designation=dest,
                            face_status="none",
                            is_active=True
                        )
                        await database.execute(insert_query)
                        total_inserted += 1
                    else:
                        # If user exists, optionally update department or designation if null
                        update_values = {}
                        if not existing_user["department"] and dept:
                            update_values["department"] = dept
                        if not existing_user["designation"]:
                            update_values["designation"] = dest
                        if not existing_user["email"] and email:
                            update_values["email"] = email
                        if not existing_user["emp_id"] and emp_id:
                            update_values["emp_id"] = emp_id

                        if update_values:
                            update_query = faculty.update().where(faculty.c.id == username).values(**update_values)
                            await database.execute(update_query)
                        total_skipped += 1

        except Exception as e:
            logger.error(f"Error reading CSV {filename}: {e}", exc_info=True)

    logger.info(f"CSV User Seeding complete. Inserted: {total_inserted}, Existing/Skipped: {total_skipped}")
