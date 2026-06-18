import os
import pandas as pd
import folium
from flask import Flask, render_template
from werkzeug.wrappers import Response
from werkzeug.middleware.dispatcher import DispatcherMiddleware

BASE_PATH = '/app/FEWSC'
app = Flask(__name__, static_url_path=f'{BASE_PATH}/static')
app.config['APPLICATION_ROOT'] = BASE_PATH

app.wsgi_app = DispatcherMiddleware(Response('Not Found', status=404), {
    BASE_PATH: app.wsgi_app
})

# Blobbin
# Add AzCopy Here vvvvv
AZURE_SAS_URI = os.environ.get("SAS")
SEALS_BLOB_NAME = "FSDHstatic/OPENDATA_HarpDietData2017-2021_EN.csv"
NAFO_BLOB_NAME = "FSDHstatic/NAFO-Subdivision-General-Coordinates.csv"
ICON_BLOB_NAME = "FSDHstatic/Seal-Icon.png"


def load_df_from_azure(blob_name, encoding='utf-8'):
    # Retrieve directly from AZURE_SAS_URI without environment fallback
    full_sas_uri = AZURE_SAS_URI
    if not full_sas_uri:
        print("[DEBUG] AZURE_SAS_URI is not set.")
        return None
    try:
        # Build file path URL with the SAS token attached
        if "?" in full_sas_uri:
            base_uri, token = full_sas_uri.split("?", 1)
            if not base_uri.endswith("/"):
                base_uri += "/"
            file_uri = f"{base_uri}{blob_name}?{token}"
        else:
            file_uri = f"{full_sas_uri}/{blob_name}" if not full_sas_uri.endswith("/") else f"{full_sas_uri}{blob_name}"
        df = pd.read_csv(file_uri, encoding=encoding)
        return df
    except Exception as e:
        print(f"[DEBUG] Error loading {blob_name} from Azure Storage: {e}")
        return None

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

def load_nafo_reference():
    try:
        # Load the NAFO Coordinates from blob
        df = load_df_from_azure(NAFO_BLOB_NAME)
        if df is None:
            print("[DEBUG] Azure load failed for NAFO reference CSV.")
            return {}

        df.columns = [c.strip().replace('\ufeff', '') for c in df.columns]
        
        # Match layout parameters
        div_col = find_col(df, ['zone'])
        lat_col = find_col(df, ['lat'])
        lon_col = find_col(df, ['long'])
        
        nafo_map = {}
        if div_col and lat_col and lon_col:
            grouped = df.groupby(div_col)
            for div_val, group in grouped:
                div_clean = str(div_val).strip().upper()
                try:
                    lat_val = float(group[lat_col].mean())
                    lon_val = float(group[lon_col].mean())
                except:
                    continue
                    
                name_val = f"{div_clean} (NAFO)"
                nafo_map[div_clean] = (lat_val, lon_val, name_val)
            
        return nafo_map
    except Exception as e:
        print(f"Error processing NAFO reference CSV: {e}")
        return {}

def parse_seals_csv():
    # Load NAFO Divisions reference file and compute centroids
    nafo_map = load_nafo_reference()
    
    
    # Try loading from Azure Storage first
    df = load_df_from_azure(
        blob_name=SEALS_BLOB_NAME
    )
    
    # If Azure loading fails, return an empty list
    if df is None:
        print("[DEBUG] Azure load failed for seals CSV. Returning empty dataset.")
        return []
        
    df.columns = [c.strip() for c in df.columns]

    id_col = find_col(df, ['sealid'])
    sex_col = find_col(df, ['sex'])
    age_col = find_col(df, ['age'])
    nafo_col = find_col(df, ['nafo'])
    prey_col = find_col(df, ['prey'])
    num_col = find_col(df, ['numberoflineitems'])
    
    if not id_col:
        print("[DEBUG] 'SealID' column absent. Returning empty dataset.")
        return []
        
    df[id_col] = df[id_col].astype(str).str.strip()
    grouped = df.groupby(id_col)
    seals_list = []
    
    for seal_id, group in grouped:
        sex = 'U'
        if sex_col:
            raw_sex = group[sex_col].iloc[0]
            if not pd.isna(raw_sex) and str(raw_sex).strip():
                sex = str(raw_sex).strip().upper()[0]
                if sex not in ['M', 'F']:
                    sex = 'U'
                    
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
                
        # Default fallback to Newfoundland and Labrador centroid (instead of Ottawa)
        lat, lon, area_name = 50.5, -56.5, f"{nafo} (NAFO)"
        
        nafo_upper = nafo.upper()
        nafo_clean = nafo_upper.replace('-', '').replace(' ', '')
        if nafo_map:
            # 1. Dash-free exact match check (3LB matches key 3L-B)
            matched = False
            for key, val in nafo_map.items():
                key_clean = key.replace('-', '').replace(' ', '')
                if nafo_clean == key_clean:
                    lat, lon, area_name = val
                    matched = True
                    break
                    
            # 2. Dash-free prefix match (if code is 3LB and map has 3L)
            if not matched:
                for key, val in nafo_map.items():
                    key_clean = key.replace('-', '').replace(' ', '')
                    if nafo_clean.startswith(key_clean) or key_clean.startswith(nafo_clean):
                        lat, lon, area_name = val
                        matched = True
                        break
                        
            # 3. Dash-free substring match
            if not matched:
                for key, val in nafo_map.items():
                    key_clean = key.replace('-', '').replace(' ', '')
                    if key_clean in nafo_clean or nafo_clean in key_clean:
                        lat, lon, area_name = val
                        break
            
        prey_items = {}
        total_items = 0
        
        for _, row in group.iterrows():
            if prey_col:
                prey_val = row[prey_col]
                # '9998' and 'empty' correctly represent empty stomachs
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
            
        # Parse Otolith size mean
        otolith_val = None
        part_cols = [c for c in group.columns if 'partmeasur' in c.lower() or 'otolith' in c.lower() or 'size' in c.lower()]
        if part_cols:
            ot_col = part_cols[-1]
            otolith_series = pd.to_numeric(group[ot_col], errors='coerce').dropna()
            if not otolith_series.empty:
                otolith_val = round(float(otolith_series.mean()), 2)
                
        if otolith_val is None or pd.isna(otolith_val):
            otolith_val = 1.0
            
        seals_list.append({
            "id": f"SEAL-{seal_id}",
            "raw_id": seal_id,
            "lat": lat,
            "lon": lon,
            "gender": sex,
            "age": age_display,
            "age_num": age_num,
            "area": area_name,
            "nafo_zone": nafo,
            "meal": meal,
            "otolith": otolith_val,
            "prey_contents": prey_items,
            "total_prey_items": total_items
        })
        
    return seals_list

@app.route('/')
def home():
    seals = parse_seals_csv()
    
    if seals:
        avg_lat = sum(s['lat'] for s in seals) / len(seals)
        avg_lon = sum(s['lon'] for s in seals) / len(seals)
        m = folium.Map(location=[avg_lat, avg_lon], zoom_start=5, control_scale=True, world_copy_jump=True)
    else:
        m = folium.Map(location=[50.5, -56.5], zoom_start=5, control_scale=True, world_copy_jump=True)
    
    # Generate the Azure SAS URL directly for the seal icon
    full_sas_uri = AZURE_SAS_URI
    
    if "?" in full_sas_uri: # is sas uri missing
        base_uri, token = full_sas_uri.split("?", 1)
        if not base_uri.endswith("/"):
            base_uri += "/"
        icon_url = f"{base_uri}{ICON_BLOB_NAME}?{token}"
    else:
        icon_url = f"{full_sas_uri}/{ICON_BLOB_NAME}" if not full_sas_uri.endswith("/") else f"{full_sas_uri}{ICON_BLOB_NAME}"

    # Group seals by NAFO zone to represent markers on the map
    nafo_groups = {}
    for seal in seals:
        zone = seal['nafo_zone']
        if zone not in nafo_groups:
            nafo_groups[zone] = []
        nafo_groups[zone].append(seal)
        
    # Find the maximum group size to scale sizes relatively
    max_group_size = max(len(g) for g in nafo_groups.values()) if nafo_groups else 1
    if max_group_size == 0:
        max_group_size = 1

    # Define linear bounds for scaling
    min_size = 30  # Minimum marker width (for small groups)
    max_size = 75  # Maximum marker width (for the largest group)
    size_range = max_size - min_size

    for zone, group in nafo_groups.items():
        num_seals_in_group = len(group)
        
        # Linear scaling relative to the maximum group size
        ratio = num_seals_in_group / max_group_size
        size = int(min_size + (ratio * size_range))
        
        lat = group[0]['lat']
        lon = group[0]['lon']
        
        icon_html = f"""
        <div onclick="window.parent.selectSealFromMap('{zone}'); event.stopPropagation();" style="
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
                <img src="{icon_url}" style="width: 100%; height: 100%; object-fit: cover;" alt="seal">
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
    return render_template('index.html', map_html=map_html, seals_data=seals)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=80, debug=True)
