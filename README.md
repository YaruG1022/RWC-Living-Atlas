# CEREO Living Atlas Enhancements
## Project Summary
### One-sentence description of the project:
Enhancing the CEREO Living Atlas to improve scalability, performance, and usability for environmental data visualization and collaboration.

### Elevator Pitch:
The CEREO Living Atlas is a geospatial web application designed to support researchers, tribal communities, and government agencies in monitoring and sharing environmental data, particularly water quality in the Columbia River Basin. This project focuses on improving the system's scalability, automating workflows, and refining its user interface to create a more robust and user-friendly platform for environmental collaboration.

### Additional Information About the Project
The Living Atlas is a vital tool developed by the Center for Environmental Research, Education, and Outreach (CEREO) at Washington State University. It enables dynamic, user-contributed geospatial data visualization and serves as a platform for fostering collaboration on environmental issues. This enhancement project will address limitations in the current system, such as performance bottlenecks and usability challenges, while introducing new features and optimizing the backend for handling larger datasets.

## Installation
### Prerequisites
Git: Ensure Git is installed on your machine. <br>
Python: Python 3.8 or higher is required. <br>
PostgreSQL: Version 13 or higher with PostGIS extension enabled. <br>
Node.js: Version 16 or higher for frontend dependencies. <br>
pipenv: For managing Python dependencies.
### Add-ons 
Mapbox: For geospatial data visualization and advanced mapping features. <br>
React: Frontend framework for building a dynamic and responsive user interface. <br>
FastAPI: Backend framework for efficient server-side operations. <br>
PostGIS: Geospatial database extension for PostgreSQL to store and query spatial data.
### Installation Steps
* Clone the repository: <br>
```
git clone https://github.com/yourusername/cereo-living-atlas.git <br>
cd cereo-living-atlas <br>
```
* Set up the backend: <br>
```
cd backend <br>
pipenv install <br>
pipenv shell <br>
python manage.py migrate <br>
python manage.py runserver <br>
```
* Set up the frontend: <br>
```
cd frontend <br>
npm install <br>
npm start <br>
```
* Seed the database (optional): <br>
python manage.py loaddata seed_data.json <br>

### Usage Instructions
- Launch the application by running the backend and frontend servers.
- Access the application via `http://localhost:3000` locally or visit `https://rwc-living-atlas.netlify.app/` in your browser.
- Log in or create an account to contribute data.
- Use the map interface to explore datasets or upload new geospatial information.
- Click on 'Add Custom Filters' button add a new filter by tag
- Click on the 'upload' button on the navigation bar to upload a new card

### Running the Application Locally

Ensure the following are installed:
- Python 3.12 or higher  
- Pip (for backend dependencies)  
- Node.js (enables npm commands)
- Postgresql

Before running the application, ensure the following are installed:
- Python 3.12 or higher
- Pip (for backend dependencies)  
- Node.js (enables npm commands)
- PostgreSQL 17

If you want to directly downloading the application and run it, follow the steps below:

1. Download the ZIP file by clicking on `Download ZIP` option.
2. Extract the zip file named `-cereo-fullstackapp--main.zip`.
3. Open your the folder where you extract the zip, navigate to directory `-cereo-fullstackapp-`.
4. Right click anywhere in that directory, select `Open in Terminal` option.
   
Now you can follow the steps in the following sections to start the frontend or the backend.

#### Starting the Frontend
1. Navitage to `/client`. On a terminal console, you can do it by simply entering `cd ./LivingAtlas1-main/client`
2. Navigate to `/client` and open a terminal.  
3. Run `npm install` to install dependencies if you haven't.  
4. Start the frontend with `npm start` (runs on port 3000).  

#### Starting the Backend  
1. Open a terminal and go to `/backend`. On a terminal console, you can do it by simply entering `cd ./LivingAtlas1-main/backend`
2. Run `pip install -r requirements.txt` to install dependencies if you haven't. 
   - If it prompts pg_config-related errors, make sure PostgreSQL is installed, then run `setx PATH "%PATH%;C:\Program Files\PostgreSQL\17\bin` in terminal as an administrator.
3. Start the backend with `uvicorn main:app --reload` (runs on port 8000).  
   - If this fails, try `python .\main.py` instead.  
4. Access API docs at `http://localhost:8000/docs`.  

#### Updating ArcGIS Services List  
The application reads ArcGIS services from the backend database. To add newly published services, use the update control in the ArcGIS Upload Panel. It scans the selected state's ArcGIS REST catalog and adds new services to the database; existing labels and folders are preserved.

#### Connecting Frontend to Local Backend  
1. Open `/client/src/api.js`.  
2. Comment out hosted `baseURL` lines.  
3. Uncomment `baseURL: 'http://localhost:8000'`.  

#### Stopping the Application  
Press **Ctrl + C** in each terminal to free ports 3000 and 8000. If not stopped, `npm start` may prompt using port 3001 instead.  


## Functionality
The Living Atlas supports the following features:

- Interactive map visualization for water quality and environmental datasets.
- User-contributed data with dynamic updates.
- Advanced filtering options for geospatial data.
- View external GIS spatial data collected from geodatabases.
- Automated workflows for user account management and data input.
- Scalability to handle larger datasets and more concurrent users.

## Known Problems
Performance under high load: Scaling tests are in progress to address potential issues with large datasets. <br>
UI responsiveness: Some pages may load slowly during heavy operations; optimizations are planned. <br>
Map rendering bugs: Occasional glitches with rendering layers; debugging in progress.  <br>
Card rendering bugs: Cards may load into the application missing some information. <br>
App security and data integrity: There is a lack of protection of user account data.

## Contributing
* Fork it!
* Create your feature branch: `git checkout -b my-new-feature`
* Commit your changes: `git commit -am 'Add some feature'`
* Push to the branch: `git push origin my-new-feature`
* Submit a pull request! 🎉

## Additional Documentation
[All Documentation](https://github.com/WSUCptSCapstone-S25-F25/-cereo-fullstackapp-/tree/main/documentation) <br>
[Sprint Reports](https://github.com/WSUCptSCapstone-S25-F25/-cereo-fullstackapp-/tree/main/documentation/sprint_report) <br>
[Client Meeting Reports](https://github.com/WSUCptSCapstone-S25-F25/-cereo-fullstackapp-/tree/main/documentation/client_report)

## License
https://github.com/WSUCptSCapstone-S25-F25/-cereo-fullstackapp-/blob/main/LICENSE.txt
