import os
import io
import urllib.parse
import pandas as pd
import folium
from flask import Flask, render_template, request, jsonify, make_response
from azure.storage.blob import ContainerClient, BlobClient

app = Flask(__name__)

# Hardcoded FSDH Prefix Fix
class FSDHProxyPrefixFix:
    def __init__(self, wsgi_app):
        self.wsgi_app = wsgi_app
    def __call__(self, environ, start_response):
        environ["SCRIPT_NAME"] = "/app/FEWSC"
        return self.wsgi_app(environ, start_response)
app.wsgi_app = FSDHProxyPrefixFix(app.wsgi_app)

AZURE_SAS_URI = os.environ.get("SAS")
SEALS_BLOB_NAME = "FSDHstatic/OPENDATA_HarpDietData2017-2021_EN.csv"
NAFO_BLOB_NAME = "FSDHstatic/NAFO-Subdivision-General-Coordinates.csv"
ICON_BLOB_NAME = "FSDHstatic/Seal-Icon.png"

def load_combined_seals_df(filenames):
    dfs = []
    for fn in filenames:
        df = load_df_from_azure(fn)
        if df is not None:
            df.columns = [c.strip() for c in df.columns]
            dfs.append(df)
    if not dfs:
        return None
    return pd.concat(dfs, ignore_index=True)

def make_template_csv():
    df = load_df_from_azure(SEALS_BLOB_NAME,1)
    try:
        df.to_csv(name,mode='x',index=False)
    except Exception as e:
        print(f"Error creating file: {e}")

def append_row(new_data: dict, blob_name=SEALS_BLOB_NAME):
    try:
        df = load_df_from_azure(blob_name)
        if df is None:
            df = pd.DataFrame(columns=list(new_data.keys()))
        new_row = pd.DataFrame([new_data])
        updated_df = pd.concat([df, new_row], ignore_index=True)
        success = save_df_to_azure(updated_df, blob_name, overwrite=True)
        if success:
            print("Row appended and uploaded to Azure successfully.")
        else:
            print("Failed to append row to Azure Storage.")
    except Exception as e:
        print(f"Error appending row: {e}")

def edit_row(row_index: int, updated_data: dict, blob_name=SEALS_BLOB_NAME):
    try:
        df = load_df_from_azure(blob_name)
        if df is None:
            print("Error: Could not load data from Azure to edit.")
            return
        if row_index < 0 or row_index >= len(df):
            print("Invalid row index.")
            return
        for col, val in updated_data.items():
            if col in df.columns:
                df.at[row_index, col] = val
            else:
                print(f"Column '{col}' not found in CSV.")
        success = save_df_to_azure(df, blob_name, overwrite=True)
        if success:
            print("Row updated and uploaded to Azure successfully.")
        else:
            print("Failed to save updated dataset back to Azure.")
    except Exception as e:
        print(f"Error editing row: {e}")

def find_col(df, options):
    for opt in options:
        for col in df.columns:
            if col.strip().lower() == opt.lower():
                return col
    for opt in options:
        for col in df.columns:
            cleaned_col = col.strip().lower()
            cleaned_opt = opt.lower()
            if cleaned_opt in cleaned_col or cleaned_col in cleaned_opt:
                return col
    return None
  
def save_df_to_azure(df, blob_name, index=False, overwrite=True, encoding='utf-8'): 
    if not AZURE_SAS_URI:
        print("[DEBUG] AZURE_SAS_URI is not set.")
        return False
    try:
        if "?" in AZURE_SAS_URI: # Format the SAS URI
            base_uri, token = AZURE_SAS_URI.split("?", 1)
            if not base_uri.endswith("/"):
                base_uri += "/"
            file_uri = f"{base_uri}{blob_name}?{token}"
        else:
            if not AZURE_SAS_URI.endswith("/"):
                file_uri = f"{AZURE_SAS_URI}/{blob_name}"
            else:
                file_uri =  f"{AZURE_SAS_URI}{blob_name}"
        
        blob_client = BlobClient.from_blob_url(file_uri) # Create Client Blob  
        csv_data = df.to_csv(index=index, encoding=encoding) # Convert DataFrame to csv file
        blob_client.upload_blob(csv_data, overwrite=overwrite) # Upload csv file to the container
        return True # Process completed without problems
    except Exception as e:
        print(f"[DEBUG] Error saving {blob_name} to Azure Storage: {e}")
        return False # There was an issue

# Loads data from FSDH using SAS URL to make a link to the file path to read data and return a DataFrame
def load_df_from_azure(blob_name, nrows=0, encoding='utf-8'):
    if not AZURE_SAS_URI:
        print("[DEBUG] AZURE_SAS_URI is not set.")
        return None
    try:
        if "?" in AZURE_SAS_URI:
            base_uri, token = AZURE_SAS_URI.split("?", 1)
            if not base_uri.endswith("/"):
                base_uri += "/"
            file_uri = f"{base_uri}{blob_name}?{token}"
        else:
            file_uri = f"{AZURE_SAS_URI}/{blob_name}" if not AZURE_SAS_URI.endswith("/") else f"{AZURE_SAS_URI}{blob_name}"
        if nrows != 0:
            df = pd.read_csv(file_uri, encoding=encoding, nrows=nrows)
        else:
            df = pd.read_csv(file_uri, encoding=encoding)
        return df
    except Exception as e:
        print(f"[DEBUG] Error loading {blob_name} from Azure Storage: {e}")
        return None

def load_nafo_reference():
    try:
        df = load_df_from_azure(NAFO_BLOB_NAME)
        if df is None:
            print("[DEBUG] Azure load failed for NAFO reference CSV.")
            return {}
        df.columns = [c.strip().replace('\ufeff', '') for c in df.columns]
        div_col = find_col(df, ['zone'])
        lat_col = find_col(df, ['lat'])
        lon_col = find_col(df, ['long'])
        nafo_map = {}
        if div_col and lat_col and lon_col:
            df[lat_col] = pd.to_numeric(df[lat_col], errors='coerce')
            df[lon_col] = pd.to_numeric(df[lon_col], errors='coerce')
            df = df.dropna(subset=[lat_col, lon_col])
            for _, row in df.iterrows():
                div_clean = str(row[div_col]).strip().upper()
                nafo_map[div_clean] = (float(row[lat_col]), float(row[lon_col]), f"{div_clean} (NAFO)")
        return nafo_map
    except Exception as e:
        print(f"Error processing NAFO reference CSV: {e}")
        return {}

def parse_seals_csv(df_to_parse=None):
    nafo_map = load_nafo_reference() 
    if df_to_parse is not None:
        df = df_to_parse
    else:
        df = load_df_from_azure(SEALS_BLOB_NAME, 0)
    
    if df is None:
        print("[DEBUG] Azure load failed for seals CSV. Returning empty dataset.")
        return []
        
    df.columns = [c.strip() for c in df.columns]
    id_col = find_col(df, ['sealid'])
    gen_col = find_col(df, ['sex'])
    age_col = find_col(df, ['age'])
    nafo_col = find_col(df, ['nafo'])
    prey_col = find_col(df, ['prey'])
    num_col = find_col(df, ['numberofindividuals'])
    
    if not id_col:
        print("[DEBUG] 'SealID' column absent. Returning empty dataset.")
        return []
        
    df[id_col] = df[id_col].astype(str).str.strip()
    grouped = df.groupby(id_col)
    seals_list = []
    
    for seal_id, group in grouped:
        gen = 'U'
        if gen_col:
            raw_gen = group[gen_col].iloc[0]
            if not pd.isna(raw_gen) and str(raw_gen).strip():
                gen = str(raw_gen).strip().upper()[0]
                    
        age_display = 'Unknown'
        age_num = None
        if age_col:
            raw_age = group[age_col].iloc[0]
            if not pd.isna(raw_age) and str(raw_age).strip() and str(raw_age).upper() not in ['NA', 'NAN']:
                try:
                    age_num = int(float(raw_age))
                    age_display = f"{age_num} years"
                except:
                    pass
                    
        nafo = 'Unknown'
        if nafo_col:
            raw_nafo = group[nafo_col].iloc[0]
            if not pd.isna(raw_nafo) and str(raw_nafo).strip():
                nafo = str(raw_nafo).strip()
                
        lat, lon, area_name = 50.5, -56.5, f"{nafo} (NAFO)"
        nafo_upper = nafo.upper()
        if nafo_map and nafo_upper in nafo_map:
            lat, lon, area_name = nafo_map[nafo_upper]
            
        prey_items = {}
        total_items = 0
        
        for _, row in group.iterrows():
            if prey_col:
                prey_val = row[prey_col]
                if pd.isna(prey_val) or str(prey_val).strip() == '' or str(prey_val).lower() == 'empty' or 'empty' in str(prey_val).lower() or '9998' in str(prey_val):
                    continue
                prey_name = str(prey_val).strip()
                if prey_name.startswith(('1', '2', '3', '4', '5', '6', '7', '8', '9', '0')):
                    parts = prey_name.split(maxsplit=1)
                    if len(parts) > 1:
                        prey_name = parts[1]
                count = 1
                if num_col and not pd.isna(row[num_col]):
                    try:
                        count = int(float(row[num_col]))
                    except:
                        pass
                prey_items[prey_name] = prey_items.get(prey_name, 0) + count
                total_items += count
                 
        if not prey_items:
            prey_items['Empty'] = 1
            meal = "Empty"
        else:
            meal = max(prey_items, key=prey_items.get)
            
        seals_list.append({
            "id": f"SEAL-{seal_id}",
            "raw_id": seal_id,
            "lat": lat,
            "lon": lon,
            "gender": gen,
            "age": age_display,
            "age_num": age_num,
            "area": area_name,
            "nafo_zone": nafo,
            "meal": meal,
            "prey_contents": prey_items,
            "total_prey_items": total_items
        })
    return seals_list

GLOBAL_SEALS_DATASET = parse_seals_csv()
@app.route('/')
def home():
    global GLOBAL_SEALS_DATASET
    
    files_param = request.args.get('files')
    if files_param:
        filenames = [f.strip() for f in files_param.split(',') if f.strip()]
        combined_df = load_combined_seals_df(filenames)
        seals = parse_seals_csv(combined_df)
    else:
        if not GLOBAL_SEALS_DATASET:
            GLOBAL_SEALS_DATASET = parse_seals_csv()
        seals = GLOBAL_SEALS_DATASET
    
    if seals:
        avg_lat = sum(s['lat'] for s in seals) / len(seals)
        avg_lon = sum(s['lon'] for s in seals) / len(seals)
        m = folium.Map(location=[avg_lat, avg_lon], zoom_start=5, control_scale=True, world_copy_jump=True)
    else:
        m = folium.Map(location=[45.416141, -75.698076], zoom_start=5, control_scale=True, world_copy_jump=True)

    icon_url = ""
    if AZURE_SAS_URI:
        if "?" in AZURE_SAS_URI:
            base_uri, token = AZURE_SAS_URI.split("?", 1)
            if not base_uri.endswith("/"):
                base_uri += "/"
            icon_url = f"{base_uri}{ICON_BLOB_NAME}?{token}"
        else:
            if not AZURE_SAS_URI.endswith("/"):
                icon_url = f"{AZURE_SAS_URI}/{ICON_BLOB_NAME}" 
            else:
                icon_url = f"{AZURE_SAS_URI}{ICON_BLOB_NAME}"

    nafo_groups = {}
    for seal in seals:
        zone = seal['nafo_zone']
        if zone not in nafo_groups:
            nafo_groups[zone] = []
        nafo_groups[zone].append(seal)
        
    max_group_size = max(len(g) for g in nafo_groups.values()) if nafo_groups else 1
    if max_group_size == 0:
        max_group_size = 1

    min_size = 30
    max_size = 75
    size_range = max_size - min_size

    for zone, group in nafo_groups.items():
        num_seals_in_group = len(group)
        ratio = num_seals_in_group / max_group_size
        size = int(min_size + (ratio * size_range))
        lat = group[0]['lat']
        lon = group[0]['lon']
        
        icon_html = f"""
        <style>
            @media (prefers-color-scheme: dark) {{
                .seal-img {{
                    filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%);
                }}
            }}
        </style>
        <div onclick="window.parent.postMessage({{ type: 'selectZone', zone: '{zone}' }}, '*'); event.stopPropagation();" style="
            display: flex;
            flex-direction: column;
            align-items: center;
            cursor: pointer;
            width: {size}px;
        ">
            <div style="
                width: {size}px;
                height: {size}px;
                border: 2px solid #3498db;
                background: white;
                border-radius: 50%;
                overflow: hidden;
                box-shadow: 0 4px 10px rgba(0,0,0,0.15);
                transition: transform 0.2s ease, border-color 0.2s ease;
            " onmouseover="this.style.transform='scale(1.15)'; this.style.borderColor='#2ecc71';" onmouseout="this.style.transform='scale(1)'; this.style.borderColor='#3498db';">
                <img src="{icon_url}" class="seal-img" style="width: 100%; height: 100%; object-fit: cover;" alt="seal">
            </div>
            <div style="
                font-size: 10px;
                font-weight: bold;
                background: rgba(255, 255, 255, 0.9);
                padding: 1px 4px;
                border: 1px solid #ccc;
                border-radius: 3px;
                margin-top: 3px;
                white-space: nowrap;
                user-select: none;
            ">{zone}</div>
        </div>
        """
        icon = folium.DivIcon(
            html=icon_html,
            icon_size=(size, size + 20),
            icon_anchor=(size / 2, size / 2)
        )
        folium.Marker(
            location=[lat, lon],
            icon=icon,
            tooltip=f"{zone} Zone ({len(group)} seals)"
        ).add_to(m)

    map_html = m._repr_html_()
    return render_template('index.html', map_html=map_html, seals_data=seals, icon_url=icon_url)

# Api stuff

@app.route('/app/FEWSC/api/files', methods=['GET']) # When requested, load the list of files (GET Method)
def list_files():
    try:
        container_client = ContainerClient.from_container_url(AZURE_SAS_URI) # Load Client 
        blobs = container_client.list_blobs() # Make array of all files in contaienr (storage)
        files = [] # Init file list
        for b in blobs: # Go through all files
            if b.name.endswith('.csv') and b.name != NAFO_BLOB_NAME: # If it's a csv file, and not the general coordinates. 
                files.append({"name": b.name, "is_master": b.name == SEALS_BLOB_NAME}) # Add it to the list, if it finds the original seals_blob_name, add it as the "master" file
        if not any(f['name'] == SEALS_BLOB_NAME for f in files): # If it somehow misses it, add it manually (false safe)
            files.insert(0, {"name": SEALS_BLOB_NAME, "is_master": True})
        return jsonify({"success": True, "files": files}) # Return the json file that contains the list of files and status of the process
    except Exception as e:
        return jsonify({
            "success": True,
            "files": [{"name": SEALS_BLOB_NAME, "is_master": True}],
            "warning": f"Blob listing fell back: {e}"
        })

@app.route('/api/files/read/<path:filename>', methods=['GET']) # When specifying read and a file name, read the file.  (Get Method)
def read_file(filename):
    df = load_df_from_azure(filename) # Load DataFrame with method
    if df is None: # If it returns "None" instead of the default column names in row 0, the file doesn't exist
        return jsonify({"success": False, "error": f"File '{filename}' not found"}), 404 # Return Error
    df = df.replace({pd.NA: None}).where(pd.notnull(df), None) # Replace none (Python) with NaN (Pandas)
    return jsonify({"success": True, "columns": list(df.columns), "rows": df.to_dict(orient='records')}) # Return Lists

@app.route('/api/files/save/<path:filename>', methods=['POST']) # When specifying save, save to the <path:filename> (Post or "Create" method)
def save_file(filename):
    if filename in [SEALS_BLOB_NAME, NAFO_BLOB_NAME]: # Make sure they can't overwrite the original dataset and the coordnates
        return jsonify({"success": False, "error": "Protected reference files cannot be overwritten."}), 403 
    data = request.json # Recieve data 
    rows = data.get('rows', []) # Make a dataframe with data from request
    df = pd.DataFrame(rows) # Make Dataframe 
    success = save_df_to_azure(df, filename, overwrite=True) # Save to azure (Refer to method docs)
    if success: # Based on if dave_df_to_azure ran to completion without issues. 
        return jsonify({"success": True})
    return jsonify({"success": False, "error": "Azure upload failed."})

@app.route('/api/files/create', methods=['POST']) # When specifying create, make a file (Post or "Create" method)
def create_file():
    data = request.json 
    filename = data.get('filename') # Get file name
    if not filename: # Answer formating
        return jsonify({"success": False, "error": "Filename required"}), 400
    if not filename.endswith('.csv'):
        filename += '.csv'
    if filename in [SEALS_BLOB_NAME, NAFO_BLOB_NAME]:
        return jsonify({"success": False, "error": "Cannot use a system protected filename."}), 400
        
    master_df = load_df_from_azure(SEALS_BLOB_NAME, nrows=1) # Get the column names from the master file
    if master_df is None:
        return jsonify({"success": False, "error": "Could not extract system headers."}), 500
        
    empty_df = pd.DataFrame(columns=master_df.columns) # Make a DataFrame based on the all the columns 
    success = save_df_to_azure(empty_df, filename, overwrite=False) # Save it to the container
    if success: 
        return jsonify({"success": True, "filename": filename})
    return jsonify({"success": False, "error": "File exists or storage write failed."})

@app.route('/api/files/delete', methods=['POST']) # When specifying, delete selected file. 
def delete_file():
    data = request.json # Ask for info on blob selected
    filename = data.get('filename') # Get file name from data
    if not filename or filename in [SEALS_BLOB_NAME, NAFO_BLOB_NAME]: # Make sure it isn't the master file or the coordinate file
        return jsonify({"success": False, "error": "Invalid or protected file name."}), 400
    try:
        if "?" in AZURE_SAS_URI:
            base_uri, token = AZURE_SAS_URI.split("?", 1)
            file_uri = f"{base_uri.rstrip('/')}/{filename}?{token}"
        else:
            file_uri = f"{AZURE_SAS_URI.rstrip('/')}/{filename}"
        blob_client = BlobClient.from_blob_url(file_uri) 
        blob_client.delete_blob() # Delete File
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

@app.route('/api/files/import', methods=['POST']) # When specifying, import a specified file. 
def import_file():
    if 'file' not in request.files: # Make sure it's a valid file
        return jsonify({"success": False, "error": "No file uploaded."}), 400
    file = request.files['file']
    if file.filename == '' or not file.filename.endswith('.csv'):
        return jsonify({"success": False, "error": "Invalid file. CSV required."}), 400
    filename = file.filename
    if filename in [SEALS_BLOB_NAME, NAFO_BLOB_NAME]:
        return jsonify({"success": False, "error": "Matches system protected file."}), 403
    try:
        imported_df = pd.read_csv(file) # Load csv file from imported file
        master_df = load_df_from_azure(SEALS_BLOB_NAME, nrows=1) # Load master file
        if master_df is not None: # Fail safe
            missing_cols = [c for c in master_df.columns if c not in imported_df.columns] # 
            for col in missing_cols:
                imported_df[col] = None
            imported_df = imported_df[master_df.columns]
        success = save_df_to_azure(imported_df, filename, overwrite=True) # Save to storage
        if success:
            return jsonify({"success": True, "filename": filename})
        return jsonify({"success": False, "error": "Upload failed."})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}) 

@app.route('/api/files/export/<path:filename>', methods=['GET']) # When Specifying. Export file
def export_file(filename):
    df = load_df_from_azure(filename) # Open the file
    if df is None:  # Check
        return "File not found", 404 
    output = io.StringIO() # Prep file like object
    df.to_csv(output, index=False) # Write DataFrame to the memory buffer
    response = make_response(output.getvalue()) # Create response with buffer content
    response.headers["Content-Disposition"] = f"attachment; filename={urllib.parse.quote(filename)}" # Set file download headers
    response.headers["Content-type"] = "text/csv" # Set type to csv
    return response # Return response to client

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=80, debug=True)