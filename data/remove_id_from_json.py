import json
import os

# 1. Obtener la ruta de la carpeta exacta donde está ESTE archivo de Python
script_dir = os.path.dirname(os.path.abspath(__file__))
file_name = "lboxd_tmdb_ids.json"
file_path = os.path.join(script_dir, file_name)

print(f"Buscando el archivo en: {file_path}")

try:
    # 2. Leer el archivo JSON original
    with open(file_path, "r", encoding="utf-8") as file:
        data = json.load(file)

    # 3. Modificar los datos eliminando la clave '_id'
    if isinstance(data, list):
        for doc in data:
            if isinstance(doc, dict):
                doc.pop("_id", None)
    elif isinstance(data, dict):
        data.pop("_id", None)
        for key, value in data.items():
            if isinstance(value, dict):
                value.pop("_id", None)

    # 4. Guardar los cambios en el mismo archivo
    with open(file_path, "w", encoding="utf-8") as file:
        json.dump(data, file, indent=4, ensure_ascii=False)
        
    print(f"¡Éxito! Se eliminó '_id' correctamente.")

except FileNotFoundError:
    print("\n--- ERROR DE RUTA ---")
    print(f"El archivo NO está en esa carpeta.")
    print("Por favor, asegúrate de que el script .py y el .json estén juntos en:")
    print(script_dir)
    print("\nContenido actual de esa carpeta:")
    try:
        print(os.listdir(script_dir))
    except Exception:
        pass
