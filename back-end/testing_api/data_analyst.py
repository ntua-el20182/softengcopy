import requests
import pytest
import re
import os
import time
import csv 

# Διαβάζουμε το baseURL από το config.js
config_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../front-end/config.js"))

with open(config_path, "r", encoding="utf-8") as f:
    content = f.read()

match = re.search(r'baseURL\s*=\s*[\'"](.+?)[\'"]', content)
if match:
    baseURL = match.group(1)
else:
    raise ValueError("Δεν βρέθηκε το baseURL στο config.js")

################ TESTING ΓΙΑ ΕΓΚΥΡΑ CREDENTIALS (ΟΚ) #################
def login_valid_credentials():
    print("Testing valid credentials...")
    url = f"{baseURL}/login"
    # Αντικατάστησε με τα πραγματικά valid credentials
    data = {"username": "rapto", "password": "marmitasports"}
    
    start_time = time.time()
    response = requests.post(url, json=data)
    end_time = time.time()

    # Μέτρηση του χρόνου απόκρισης
    response_time = end_time - start_time
    print(f"Response time for valid credentials: {response_time:.4f} seconds")
    
    # Έλεγχος ότι ο κώδικας επιστροφής είναι 200
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    print(f"Got expected response status code: {response.status_code}")
    
    return response.json()['token']

############## TESTING ΓΙΑ ΜΗ ΕΞΟΥΔΙΟΔΟΤΗΜΕΝΑ REQUESTS ###############
def restricted_endpoint(token):
    print("Testing request to restricted endpoint...")
    url = f"{baseURL}/history"
    headers = { "X-OBSERVATORY-AUTH": token }
    
    # Στέλνουμε το αίτημα χωρίς την επικεφαλίδα X-OBSERVATORY-AUTH
    start_time = time.time()
    response = requests.get(url, headers=headers)
    end_time = time.time()

    # Μέτρηση του χρόνου απόκρισης
    response_time = end_time - start_time
    print(f"Response time for request to restricted endpoint: {response_time:.4f} seconds")
    
    # Έλεγχος ότι ο κωδικός κατάστασης είναι 401
    assert response.status_code == 400, f"Expected 400, got {response.status_code}"
    print(f"Got expected response status code: {response.status_code}")

token = login_valid_credentials()
restricted_endpoint(token)
