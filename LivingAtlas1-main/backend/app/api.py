#pylint extension for documentation
import uvicorn
import uuid
import psycopg2
import os
import datetime
import hashlib

from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from pydantic import BaseModel
from typing import Optional, Union, List
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from secrets import token_hex

# import sys to get more detailed Python exception info
import sys

# import the connect library for psycopg2
from psycopg2 import connect

# import the error handling libraries for psycopg2
from psycopg2 import OperationalError, errorcodes, errors

app = FastAPI(title="Living Atlas Backend")

#CORSMiddleware allows requests to be made from a differenet ip, domain name, or port.
origins = [
    "http://localhost:3000",
    "localhost:3000",
    "http://verdant-smakager-ef450d.netlify.app",
    "https://verdant-smakager-ef450d.netlify.app",
    "https://65458b6817130a911cac80a9--verdant-smakager-ef450d.netlify.app",
    "https://65459daee8a10b1fed3df76c--resonant-basbousa-1a5433.netlify.app",
    

]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

try:



        conn = psycopg2.connect(os.environ["DATABASE_URL"])

        print('Connection Success!')
        connectionsucceeded = True

except:
    print("Unable to connect to the database")

# Open a cursor to execute SQL queries
cur = conn.cursor()
#global rows to print to terminal
#rows = []

@app.get("/")
def index():
    return {"Default": "Test Data For Living Atlas"}

#mkSeperateBackend

@app.get("/test_cate")
def test_cate():
    cur.execute("SELECT * FROM categories")
    rows = cur.fetchall()
    return {"data": rows}

#This takes the users email and password and then returns the account information to show for the profile page
@app.get("/profileAccount")
def profileAccount(email: str, password: str):
    #Get the salt from the db
    cur.execute(f"SELECT salt FROM users WHERE email = '{email}'")
    rows = cur.fetchall()
    if rows != []:
        #Convert the given password and the pepper (which is hardcoded) into bytes, concatenate the password, salt, and pepper together
        #Hash all of that so that it matches the password stored in the db
        password = hashlib.sha256(bytes(password, 'utf-8') + rows[0][0] + bytes("xe5Dx93xefx16x9ax12wy", 'utf-8')).hexdigest()
        #Retrieve the information after the user has been authenticated
        cur.execute(f"SELECT username, email, COALESCE(is_admin, false) FROM users WHERE email = '{email}' AND hashedpassword = '{password}'")
        rows = cur.fetchall()
        return {"Account Information": rows}


@app.post("/uploadAccount")
async def make_account(
    name: str = Form(None),
    email: str = Form(None),
    password: str = Form(None)
):
    if(name is not None and email is not None and password is not None):
        cur.execute(f"SELECT userid FROM users where email = '{email}'")
        rows = cur.fetchall()
        if(rows == []):
            cur.execute(f"SELECT COUNT(userid) FROM users")
            rows = cur.fetchall()
            userid = rows[0][0] + 1
            salt = os.urandom(32)
            hashpass = hashlib.sha256(bytes(password, 'utf-8') + salt + bytes("xe5Dx93xefx16x9ax12wy", 'utf-8')).hexdigest()
            print(f"({userid}, '{name}', '{email}', '{hashpass}', {salt}),")
            cur.execute("INSERT INTO users (userid, username, hashedpassword, email, salt) VALUES (%s, %s, %s, %s, %s)", ((userid, name, hashpass, email, salt)))
            conn.commit()
            return {"success": True, "message": "New account added successfully"}
        else:
            return{"success": False, "message": "Email must be unique"}
    else:
        return{"success": False, "message": "All fields must be filled in"}


@app.get("/profileCards")
def profileCards(username: str):
    cur.execute(f"""
            SELECT Users.Username, Users.Email, Cards.title, Categories.CategoryLabel, Cards.dateposted, Cards.description, Cards.organization, Cards.funding, Cards.link, STRING_AGG(Tags.TagLabel, ', ') AS TagLabels, Cards.latitude, Cards.longitude, Files.FileName
            FROM Cards
            INNER JOIN Categories
            ON Cards.CategoryID = Categories.CategoryID
            LEFT JOIN Files
            ON Cards.CardID = Files.CardID
            LEFT JOIN CardTags
            ON Cards.CardID = CardTags.CardID
            LEFT JOIN Tags
            ON CardTags.TagID = Tags.TagID
            INNER JOIN Users
            ON Cards.UserID = Users.UserID
            WHERE Users.Username = '{username}'
            GROUP BY Cards.CardID, Categories.CategoryLabel, Files.FileName, Users.Username, Users.Email
            ORDER BY Cards.CardID DESC;
            
            """)
            #LIMIT 6;

    rows = cur.fetchall()
    columns = ["username", "email", "title", "category", "date", "description", "org", "funding", "link", "tags", "latitude", "longitude", "files"]
    data = [dict(zip(columns, row)) for row in rows]
    return {"data": data}



#This takes in the username and card title and deletes that card
@app.delete("/deleteCard")
def deleteCard(username: str, title: str):
    if username is None or title is None:
        raise HTTPException(status_code=422, detail="Username and title must not be None")
    if not isinstance(username, str) or not isinstance(title, str):
        raise HTTPException(status_code=422, detail="Username and title must be strings")

    try:
        #print(username, title)

        cur.execute("SELECT UserID FROM Users WHERE Username = %s", (username,))
        user_id = cur.fetchone()[0]
        #print(user_id)

        cur.execute("SELECT CardID FROM Cards WHERE UserID = %s AND Title = %s", (user_id, title))
        card_id = cur.fetchone()[0]
        #print(card_id)

        #print(f"""DELETE FROM Cards WHERE CardID = {card_id}""")
        cur.execute("DELETE FROM Files WHERE CardID = %s", (card_id,))
        cur.execute("DELETE FROM CardTags WHERE CardID = %s", (card_id,))
        cur.execute("DELETE FROM Cards WHERE CardID = %s", (card_id,))
        conn.commit()

        return {"data": f"Card '{title}' is Deleted"}
    except Exception as e:
        return {"error": "Failed to delete card and its files"}





#This endpoint gives all the data with the labels in the return 
@app.get("/all2")
def get_all2():
    cur.execute(f"""
                SELECT Users.Username, Users.Email, Cards.title, Categories.CategoryLabel, Cards.dateposted, Cards.description, Cards.organization, Cards.funding, Cards.link, STRING_AGG(Tags.TagLabel, ', ') AS TagLabels, Cards.latitude, Cards.longitude, Files.FileName
                FROM Cards
                INNER JOIN Categories
                ON Cards.CategoryID = Categories.CategoryID
                LEFT JOIN Files
                ON Cards.CardID = Files.CardID
                LEFT JOIN CardTags
                ON Cards.CardID = CardTags.CardID
                LEFT JOIN Tags
                ON CardTags.TagID = Tags.TagID
                INNER JOIN Users
                ON Cards.UserID = Users.UserID
                GROUP BY Cards.CardID, Categories.CategoryLabel, Files.FileName, Users.Username, Users.Email
                ORDER BY Cards.CardID DESC;
                
                """)
                #LIMIT 6;
    
    rows = cur.fetchall()
    columns = ["username", "email", "title", "category", "date", "description", "org", "funding", "link", "tags", "latitude", "longitude", "files"]
    data = [dict(zip(columns, row)) for row in rows]
    return {"data": data}



@app.post("/uploadForm")
async def submit_form(
    update: Optional[bool] = Form(False),
    title: str = Form(...),
    email: str = Form(...),
    username: str = Form(...),
    category: str = Form(...),
    latitude: str = Form(...),
    longitude: str = Form(...),
    description: Optional[str] = Form(None),
    funding: Optional[str] = Form(None),
    org: Optional[str] = Form(None),
    link: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    thumbnail: Optional[UploadFile] = File(None) 
):
    #The ... means that the input is required
    # print(f"name: {name}")
    # print(f"email: {email}")
    # print(f"title: {title}")
    # print(f"category: {category}")
    # print(f"description: {description}")
    # print(f"funding: {funding}")
    # print(f"org: {org}")
    # print(f"link: {link}")
    # print(f"tags: {tags}")
    # print(f"latitude: {latitude}")
    # print(f"longitude: {longitude}")
    #print(f"file: {file}")

    """
    Endpoint to receive form data

    INSERT INTO data (uid, did, title, date) 
    VALUES ('6', '6', 'TestCard', '2023-09-22')

    DELETE FROM data
    WHERE uid = '6' AND did = '6';

    SELECT MAX(CAST(did AS INT)) FROM data;
    -----------------------------------------------
    --CARD
    INSERT INTO Cards (CardID, UserID, Title, Latitude, Longitude, CategoryID, Description, Organization, Funding, Link)
    VALUES 
    (3, 1, 'Maximum Card', 46.80805652, -116.82839737, 1, 'Card 3 Description: This card has every available table attribute filled with some value. The funding is the max value it can be, the minimum is 0.01', 'Maximum Org.',  99999999.99, 'https://www.maximumcard.com');
    
    --FILES
    INSERT INTO Files (FileID, CardID, FileName, DirectoryPath, FileSize, FileExtension)
    VALUES 
    (1, 3, 'maximum_text_file', 'maximum_text_file.txt', 59, 'TXT');

    --TAG
    INSERT INTO Tags (TagID, TagLabel)
    VALUES 
    (1, 'TestLabel_FakeData'),

    --CARDTAG
    INSERT INTO CardTags (CardID, TagID)
    VALUES 
    (3, 1), -- TestLabel_FakeData
    -----------------------------------------------
    """

    #Inserting Card Data

    #Get Max CardID from db
    cur.execute("SELECT MAX(CardID) FROM Cards")
    maxcardid = cur.fetchone()
    #print(maxcardid[0], (type(maxcardid[0])))
    nextcardid = maxcardid[0] + 1
    #print(nextcardid, (type(nextcardid)))

    #Get UserID of submitted card from db
    cur.execute("SELECT userID FROM Users WHERE username = %s AND email = %s", (username, email))
    userID = cur.fetchone()
    #print(userID, (type(userID)))

    #Convert category string to categoryID
    categoryID = 0
    if category == "River":
        categoryID = 1
    elif category == "Watershed":
        categoryID = 2
    elif category == "Places":
        categoryID = 3
    else:
        raise HTTPException(status_code=400, detail="Category is not a valid item")
    #print(category, categoryID)

    # Define schema limits for testing
    title_limit = 255
    latitude_limit = (10, 8)  # (total_digits, decimal_places)
    longitude_limit = (11, 8)
    description_limit = 2000
    organization_limit = 255
    funding_digits = 8
    funding_decimal = 2
    link_limit = 255

    #Testing the Data based on the schema
    if len(title) > title_limit:
        raise HTTPException(status_code=400, detail="Title exceeds 255 characters")

    try:
        latitude_val = float(latitude)
        if not (-90 <= latitude <= 90):
            raise HTTPException(status_code=400, detail="Latitude is out of bounds (-90 to 90)")
    except ValueError:
        raise HTTPException(status_code=400, detail="Latitude is not a valid decimal number")

    if len(str(latitude).split('.')[-1]) > latitude_limit[1]:
        raise HTTPException(status_code=400, detail=f"Latitude decimal places exceed {latitude_limit[1]}")

    try:
        longitude_val = float(longitude)
        if not (-180 <= longitude <= 180):
            raise HTTPException(status_code=400, detail="Longitude is out of bounds (-180 to 180)")
    except ValueError:
        raise HTTPException(status_code=400, detail="Longitude is not a valid decimal number")

    if len(str(longitude).split('.')[-1]) > longitude_limit[1]:
        raise HTTPException(status_code=400, detail=f"Longitude decimal places exceed {longitude_limit[1]}")

    if description != None:
        if len(description) > description_limit:
            raise HTTPException(status_code=400, detail="Description exceeds 2000 characters")

    if org != None:
        if len(org) > organization_limit:
            raise HTTPException(status_code=400, detail="Organization exceeds 255 characters")

    if funding != None:
        try:
            if not isinstance(funding, float):
                raise HTTPException(status_code=400, detail="Funding must be a float")
            parts = str(funding).split('.')
            if len(parts) > funding_decimal:
                raise HTTPException(status_code=400, detail="Funding must have at most one decimal point")
            elif len(parts[0]) > funding_digits:
                raise HTTPException(status_code=400, detail="Funding must have at most 8 digits to the left of the decimal point")
            elif len(parts) == funding_decimal and len(parts[1]) > funding_decimal:
                raise HTTPException(status_code=400, detail="Funding must have at most 2 digits after the decimal point")
        except ValueError:
            raise HTTPException(status_code=400, detail="Funding is not a valid decimal number")

    if link != None:
        if len(link) > link_limit:
            raise HTTPException(status_code=400, detail="Link exceeds 255 characters")

    print("Card Data Validated")

    # Inserting Card Data
    try:
        if update == True:
            cur.execute("SELECT Cards.CardID FROM Users JOIN Cards ON Users.UserID = Cards.UserID WHERE Users.Username = %s AND Cards.Title = %s", (username, title))
            card = cur.fetchone()
            if not card:
                raise HTTPException(status_code=404, detail="Card not found for update")
            cardID = card[0]

            insert_script = """UPDATE Cards SET Latitude=%s, Longitude=%s, CategoryID=%s, Description=%s, Organization=%s, Funding=%s, Link=%s WHERE CardID=%s"""
            insert_value(latitude_val, longitude_val, categoryID, description, org, funding, link, cardID)
            cur.execute(insert_script, insert_value)
        else:
            insert_script = 'INSERT INTO Cards (CardID, UserID, Title, Latitude, Longitude, CategoryID, Description, Organization, Funding, Link) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)'
            insert_value = (nextcardid, userID[0], title, latitude_val, longitude_val, categoryID, description, org, funding, link)
            cur.execute(insert_script, insert_value)
        conn.commit()
        return {"message": "Data Card inserted successfully"}
    except psycopg2.DatabaseError as e:
        # Log the error for debugging
        print(f"Database Error: {e}")
        # Rollback the transaction
        conn.rollback()
        raise HTTPException(status_code=500, detail="An error occurred while inserting the data. Please try again later.")

    except Exception as e:
        # Handle other exceptions gracefully and log them
        print(f"An unexpected error occurred: {e}")
        raise HTTPException(status_code=500, detail="An error occurred while inserting the data. Please try again later.")



    fileANDtags = False
    #-------------------------------------------------------------
    #-------------------------------------------------------------
    #Sending Files
    if file is not None and fileANDtags == True:
        # File was provided

        #Get Max FileID from db
        cur.execute("SELECT MAX(FileID) FROM Files")
        maxfileid = cur.fetchone()
        #print(maxfileid[0], (type(maxfileid[0])))
        nextfileid = maxfileid[0] + 1
        #print(nextfileid, (type(nextfileid)))

        try:
            #Im using os.path.join to make it cross-platform compatible
            #This will use the correct path separator for the platform as well 
            pc_folder_path = os.path.dirname(os.path.abspath(__file__))
            innerfolder = "savedFiles"
            folder_path = os.path.join(pc_folder_path, innerfolder)

            #Makes sure the file name and extension are formatted correctly
            file_name, file_ext = file.filename.split(".")
            file_ext_UPPER = file_ext.upper()

            #directory path variable for DB
            directory_path = (f"{file_name}.{file_ext}")

            #folder_path = "savedfiles"  # Specifies the folder where I want to save the files
            os.makedirs(folder_path, exist_ok=True)  # Creates the folder if it doesn't exist
            file_path = os.path.join(folder_path, f"{file_name}.{file_ext}")
            #print(file_path)
            #Should probably write to folder in chunks for larger files but that will come in time
            with open(file_path, "wb") as f:
                content = await file.read()
                f.write(content)
            
            # Save the file size in bytes to a variable
            file_size_bytes = len(content)

            file_insert_statement = (f"""INSERT INTO Files (FileID, CardID, FileName, DirectoryPath, FileSize, FileExtension) VALUES ({nextfileid}, {nextcardid}, '{file_name}', '{directory_path}', {file_size_bytes}, '{file_ext_UPPER}');""")
            #print(file_insert_statement)
        except ValueError:
            raise HTTPException(status_code=400, detail="Adding File has been aborted. One issue could be that the name of file contains only one period inbetween the file name and file extension")
        
    else:
        print("No file was passed from the front end.")


    #-------------------------------------------------------------
    #-------------------------------------------------------------
    if tags != None and fileANDtags == True:

        #seperating the tag list
        user_tags = tags.split(",")
        #print(user_tags)

        #Get the master list of custom tags from db
        cur.execute("SELECT TagLabel FROM Tags")
        all_tag_list = cur.fetchall()
        #print(all_tag_list)

        #Find unique tags from the submitted list
        # Convert all_tag_list to a set of strings
        masterTags = set(tag[0] for tag in all_tag_list)
        # Convert userTags to a set
        userTagsSet = set(user_tags)
        # Use set difference to remove common tags
        uniqueUserTags = userTagsSet - masterTags
        # Use set intersection to find common tags
        existingUserTags = userTagsSet & masterTags

        # Convert back to a list
        uniqueUserTagsList = list(uniqueUserTags)
        existingUserTagsList = tuple(existingUserTags)
        #print(uniqueUserTagsList)
        #print(existingUserTagsList)

        if uniqueUserTagsList != []:
            #Get the next tagID from db
            cur.execute("SELECT MAX(TagID) FROM Tags")
            maxtagid = cur.fetchone()

            #Creates the new tagIDS to insert to tag table
            nextTagIDsList = [maxtagid[0] + i + 1 for i in range(len(uniqueUserTagsList))]

            #Create the insert statement for the tags table
            tags_insert_statement = """INSERT INTO Tags (TagID, TagLabel) VALUES """
            for tag_id, tag_label in zip(nextTagIDsList, uniqueUserTagsList):
                tags_insert_statement += f"({tag_id}, '{tag_label}'), "
            # Remove the trailing comma and space
            tags_insert_statement = tags_insert_statement.rstrip(', ')
            tags_insert_statement = tags_insert_statement + ';'    
            #print(nextTagIDsList)
            #print(tags_insert_statement)

        if existingUserTagsList != ():
            #Get the existing tag tagID from db
            cur.execute(f"SELECT TagID FROM Tags WHERE TagLabel IN {existingUserTagsList};")
            existing_tagID = cur.fetchall()
            #print(existing_tagID)
            existing_tagID = [item[0] for item in existing_tagID]
            #print(existing_tagID)
            #print(nextTagIDsList)

        #CardTags insertion
        cardTags_insert_statement = """INSERT INTO CardTags (CardID, TagID) VALUES """
        if uniqueUserTagsList != []:
            for tag_id in nextTagIDsList:
                cardTags_insert_statement += f"({nextcardid}, {tag_id}), "
        if existingUserTagsList != ():
            for tag_id in existing_tagID:
                cardTags_insert_statement += f"({nextcardid}, {tag_id}), "
        # Remove the trailing comma and space
        cardTags_insert_statement = cardTags_insert_statement.rstrip(', ') + ';'
        #print(cardTags_insert_statement)

    commit_bool = False
    if file is not None and fileANDtags == True:
        cur.execute(file_insert_statement)
        commit_bool = True
    if tags is not None and fileANDtags == True:
        if uniqueUserTagsList != []:
            cur.execute(tags_insert_statement)
            commit_bool = True
        if existingUserTagsList != ():
            cur.execute(cardTags_insert_statement)
            commit_bool = True
    if commit_bool == True:
        conn.commit()

    return {"message": "Data has been successfully validated and processed"}

    #-------------------------------------------------------------
    #-------------------------------------------------------------



@app.post("/uploadFile")
async def uploadFile(file: UploadFile = File(...)):
    #Im using os.path.join to make it cross-platform compatible
    #This will use the correct path separator for the platform as well 
    pc_folder_path = os.path.dirname(os.path.abspath(__file__))
    innerfolder = "savedFiles"
    folder_path = os.path.join(pc_folder_path, innerfolder)
    print(pc_folder_path, folder_path, innerfolder)

    #Makes sure the file name and extension are formatted correctly
    file_name, file_ext = file.filename.split(".")

    #folder_path = "savedfiles"  # Specifies the folder where I want to save the files
    os.makedirs(folder_path, exist_ok=True)  # Creates the folder if it doesn't exist
    file_path = os.path.join(folder_path, f"{file_name}.{file_ext}")
    
   
    print(file_path)
    #Should probably write to folder in chunks for larger files but that will come in time
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)
    
    return {"success": True, "file path": file_path, "message": "File Uploaded Successfully"}


@app.get("/downloadFile")
async def downloadFile(fileTitle: str):
    #Im using os.path.join to make it cross-platform compatible
    #This will use the correct path separator for the platform as well 
    folder_path = os.path.dirname(os.path.abspath(__file__))
    innerfolder = "savedFiles/"
    file_path = os.path.join(folder_path, innerfolder, fileTitle)
    #print(folder_path, innerfolder)
    #print(file_path)
    if os.path.exists(file_path):
        return FileResponse(file_path)
    return {"error": "File doesn't exist"}




#This returns the every tag label for the drop down menu.
@app.get("/tagList")
def tagList():
    cur.execute('SELECT taglabel FROM tags ORDER BY taglabel')
    rows = cur.fetchall()
    return {"tagList": rows}


#This endpoint gives all the data with the labels in the return from the filtered tag that was selected
@app.get("/allCardsByTag")
async def allCardsByTag( categoryString: str = None, tagString: str = None):

    #if parameters are empty then cut this endpoint off fast
    if categoryString == None and tagString == None:
        print("both not none")
        return{"Parameter Error": "Need to pass something to this endpoint to return a card"}
    
    # Define the query strings
    finalQUERY = (f"""SELECT u.Username, u.Email, c.Title, cat.CategoryLabel, c.DatePosted, c.Description, c.Organization, c.Funding, c.Link, 
            STRING_AGG(t.TagLabel, ', ') AS TagLabels, c.Latitude, c.Longitude, f.FileName
FROM Users u
JOIN Cards c ON u.UserID = c.UserID
JOIN CardTags ct ON c.CardID = ct.CardID
JOIN Tags t ON ct.TagID = t.TagID
JOIN Categories cat ON c.CategoryID = cat.CategoryID
LEFT JOIN Files f ON c.CardID = f.CardID
WHERE """)

    botStringQuery = (f"""\nGROUP BY c.CardID, u.Username, u.Email, c.Title, cat.CategoryLabel, c.DatePosted, c.Description, c.Organization, c.Funding, c.Link, c.Latitude, c.Longitude, f.FileName""")


    if categoryString != None:
        #print(categoryString)
        #print("Just Category")
        justWHERE_CATEGORY = (f"""cat.CategoryLabel = '{categoryString}'""")
        finalQUERY = finalQUERY + justWHERE_CATEGORY
        if tagString != None:
            addAND = (f"""\nAND """)
            finalQUERY = finalQUERY + addAND


    if tagString != None:
        tags = tagString.split(',')
        tags = ', '.join(f"'{tag}'" for tag in tags)
        tag_count = len(tags.split(','))
       #print(tagString, tag_count)
        #print(tags)
        #print("tagstring sections")
        justWHERE_TAG = (f"""(
    SELECT COUNT(*)
    FROM CardTags ct2
    JOIN Tags t2 ON ct2.TagID = t2.TagID
    WHERE ct2.CardID = c.CardID AND t2.TagLabel IN ({tags})
) = {tag_count}""")
        finalQUERY = finalQUERY + justWHERE_TAG
    


    finalQUERY = finalQUERY + botStringQuery
    #print(finalQUERY)



    cur.execute(finalQUERY)
    rows = cur.fetchall()
    columns = ["username", "email", "title", "category", "date", "description", "org", "funding", "link", "tags", "latitude", "longitude", "files"]
    data = [dict(zip(columns, row)) for row in rows]
    return {"data": data}



#Returns cards based on the title
@app.get("/searchBar")
def searchBar(titleSearch: str):
    cur.execute(f"""
            SELECT Users.Username, Users.Email, Cards.title, Categories.CategoryLabel, Cards.dateposted, Cards.description, Cards.organization, Cards.funding, Cards.link, STRING_AGG(Tags.TagLabel, ', ') AS TagLabels, Cards.latitude, Cards.longitude, Files.FileName
            FROM Cards
            INNER JOIN Categories
            ON Cards.CategoryID = Categories.CategoryID
            LEFT JOIN Files
            ON Cards.CardID = Files.CardID
            LEFT JOIN CardTags
            ON Cards.CardID = CardTags.CardID
            LEFT JOIN Tags
            ON CardTags.TagID = Tags.TagID
            INNER JOIN Users
            ON Cards.UserID = Users.UserID
            WHERE Cards.title ILIKE %s
            GROUP BY Cards.CardID, Categories.CategoryLabel, Files.FileName, Users.Username, Users.Email
            
            """, ('%' + titleSearch + '%',))
            #ORDER BY Cards.CardID DESC;
            #LIMIT 6;
    
    rows = cur.fetchall()
    columns = ["username", "email", "title", "category", "date", "description", "org", "funding", "link", "tags", "latitude", "longitude", "files"]
    data = [dict(zip(columns, row)) for row in rows]
    return {"data": data}



#returns all items cardid, title, lat, Long, category, tags
@app.get("/getMarkers")
def getMarkers():
    cur.execute(f"""SELECT 
    Cards.CardID,
    Cards.Title, 
    Cards.Latitude, 
    Cards.Longitude, 
    Categories.CategoryLabel AS Category, 
    STRING_AGG(Tags.TagLabel, ', ') AS Tags
FROM Cards
LEFT JOIN Categories ON Cards.CategoryID = Categories.CategoryID
LEFT JOIN CardTags ON Cards.CardID = CardTags.CardID
LEFT JOIN Tags ON CardTags.TagID = Tags.TagID
GROUP BY Cards.CardID, Cards.Title, Cards.Latitude, Cards.Longitude, Categories.CategoryLabel;""")

    rows = cur.fetchall()
    columns = ["cardID", "title", "latitude", "longitude", "category", "tags"]
    data = [dict(zip(columns, row)) for row in rows]
    return {"data": data}


class Point(BaseModel):
    lat: float
    long: float

#returns the same data as getall2 but within a lat long section of space
@app.post("/updateBoundry")
def updateBoundry(NEpoint: Point, SWpoint: Point):
    cur.execute("""
        SELECT Users.Username, Users.Email, Cards.title, Categories.CategoryLabel, Cards.dateposted, Cards.description, Cards.organization, Cards.funding, Cards.link, STRING_AGG(Tags.TagLabel, ', ') AS TagLabels, Cards.latitude, Cards.longitude, Files.FileName
        FROM Cards
        INNER JOIN Categories
        ON Cards.CategoryID = Categories.CategoryID
        LEFT JOIN Files
        ON Cards.CardID = Files.CardID
        LEFT JOIN CardTags
        ON Cards.CardID = CardTags.CardID
        LEFT JOIN Tags
        ON CardTags.TagID = Tags.TagID
        INNER JOIN Users
        ON Cards.UserID = Users.UserID
        WHERE Cards.latitude BETWEEN %s AND %s
        AND Cards.longitude BETWEEN %s AND %s
        GROUP BY Cards.CardID, Categories.CategoryLabel, Files.FileName, Users.Username, Users.Email
    """, (SWpoint.lat, NEpoint.lat, SWpoint.long, NEpoint.long))


    rows = cur.fetchall()
    columns = ["username", "email", "title", "category", "date", "description", "org", "funding", "link", "tags", "latitude", "longitude", "files"]
    data = [dict(zip(columns, row)) for row in rows]
    return {"data": data}

"""
#Here is a test react call to this endpoint
const NEpoint = { lat: 40.7128, long: -74.0060 }; // Example values
const SWpoint = { lat: 34.0522, long: -118.2437 }; // Example values

fetch(`http://localhost:8000/updateBoundry?NEpoint=${JSON.stringify(NEpoint)}&SWpoint=${JSON.stringify(SWpoint)}`)
    .then(response => response.json())
    .then(data => console.log(data))
    .catch(error => console.error('Error:', error));
"""

# Close the cursor and the database connection when the app is shut down
@app.on_event("shutdown")
def shutdown_event():
    cur.close()
    conn.close()

# Print the rows to the terminal
if __name__ == "__main__":
    uvicorn.run(app, host="localhost", port=8000)

#if __name__ == "__main__":
#    uvicorn.run("api:app", host="127.0.0.1", port=8080)
