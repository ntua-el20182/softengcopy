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

############# TESTING ΓΙΑ ΑΚΥΡΑ CREDENTIALS (NO CONTENT) #############
def login_invalid_credentials():
    print("Testing invalid credentials...")
    url = f"{baseURL}/login"
    data = {"username": "wronguser", "password": "wrongpass"}
    
    start_time = time.time()
    response = requests.post(url, json=data)
    end_time = time.time()

    # Μέτρηση του χρόνου απόκρισης
    response_time = end_time - start_time
    print(f"Response time for invalid credentials: {response_time:.4f} seconds")
    
    # Έλεγχος ότι ο κώδικας επιστροφής είναι 204
    assert response.status_code == 204, f"Expected 204, got {response.status_code}"
    print(f"Got expected response status code: {response.status_code}")

################ TESTING ΓΙΑ ΕΓΚΥΡΑ CREDENTIALS (ΟΚ) #################
def login_valid_credentials():
    print("Testing valid credentials...")
    url = f"{baseURL}/login"
    # Αντικατάστησε με τα πραγματικά valid credentials
    data = {"username": "georgegiann", "password": "tomikropsari"}
    
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
def request_without_token():
    print("Testing request without 'X-OBSERVATORY-AUTH' header...")
    url = f"{baseURL}/toll"
    
    # Στέλνουμε το αίτημα χωρίς την επικεφαλίδα X-OBSERVATORY-AUTH
    start_time = time.time()
    response = requests.get(url)
    end_time = time.time()

    # Μέτρηση του χρόνου απόκρισης
    response_time = end_time - start_time
    print(f"Response time for request without 'X-OBSERVATORY-AUTH' header: {response_time:.4f} seconds")
    
    # Έλεγχος ότι ο κωδικός κατάστασης είναι 401
    assert response.status_code == 401, f"Expected 401, got {response.status_code}"
    print(f"Got expected response status code: {response.status_code}")

def restricted_endpoint(token):
    print("Testing request to restricted endpoint...")
    url = f"{baseURL}/admin/healthcheck"
    headers = { "X-OBSERVATORY-AUTH": token }
    
    # Στέλνουμε το αίτημα χωρίς την επικεφαλίδα X-OBSERVATORY-AUTH
    start_time = time.time()
    response = requests.get(url, headers=headers)
    end_time = time.time()

    # Μέτρηση του χρόνου απόκρισης
    response_time = end_time - start_time
    print(f"Response time for request to restricted endpoint: {response_time:.4f} seconds")
    
    # Έλεγχος ότι ο κωδικός κατάστασης είναι 401
    assert response.status_code == 401, f"Expected 401, got {response.status_code}"
    print(f"Got expected response status code: {response.status_code}")

############### TESTING ΓΙΑ ΕΞΟΥΔΙΟΔΟΤΗΜΕΝΑ REQUESTS #################
def request_with_token(token):
    print("Testing request to reachable endpoint...")
    url = f"{baseURL}/toll?format=csv"
    headers = { "X-OBSERVATORY-AUTH": token }
    
    # Στέλνουμε το αίτημα χωρίς την επικεφαλίδα X-OBSERVATORY-AUTH
    start_time = time.time()
    response = requests.get(url, headers=headers)
    end_time = time.time()

    # Μέτρηση του χρόνου απόκρισης
    response_time = end_time - start_time
    print(f"Response time for request with token: {response_time:.4f} seconds")
    
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    print(f"Got expected response status code: {response.status_code}")

    api_data = response.text
    api_lines = api_data.strip().split("\n")
    api_lines = api_lines[1:]

    file_path = os.path.join(os.path.dirname(__file__), 'op2_tolls.csv')
    with open(file_path, mode='r', encoding="utf-8") as file:
        csv_lines = file.read().strip().split("\n")
    csv_lines = [line.replace('"', '') for line in csv_lines]
    csv_lines = csv_lines[1:]

    assert api_lines == csv_lines, f"Didn't get expected response data"
    print(f"Got expected response data!")

##################### TESTING ΓΙΑ BAD REQUESTS #######################
def request_with_short_parameters(token):
    print("Testing request with short parameters to reachable endpoint...")
    url = f"{baseURL}/history_filtered/from_me/20240101-20240202"
    headers = { "X-OBSERVATORY-AUTH": token }
    
    # Στέλνουμε το αίτημα χωρίς την επικεφαλίδα X-OBSERVATORY-AUTH
    start_time = time.time()
    response = requests.get(url, headers=headers)
    end_time = time.time()

    # Μέτρηση του χρόνου απόκρισης
    response_time = end_time - start_time
    print(f"Response time for request with short parameters: {response_time:.4f} seconds")
    
    assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    print(f"Got expected response status code: {response.status_code}")

def request_with_false_parameters(token):
    print("Testing request with false parameters to reachable endpoint...")
    url = f"{baseURL}/history_filtered/from_me/20240101-20240202/s_amount/e_amount/stakeholders"
    headers = { "X-OBSERVATORY-AUTH": token }
    
    # Στέλνουμε το αίτημα χωρίς την επικεφαλίδα X-OBSERVATORY-AUTH
    start_time = time.time()
    response = requests.get(url, headers=headers)
    end_time = time.time()

    # Μέτρηση του χρόνου απόκρισης
    response_time = end_time - start_time
    print(f"Response time for request with false parameters: {response_time:.4f} seconds")
    
    assert response.status_code == 400, f"Expected 400, got {response.status_code}" 
    print(f"Got expected response status code: {response.status_code}")

################## TESTING ΓΙΑ ΝΟΤ FOUND REQUESTS ####################
def no_endpoint():
    print("Testing request to unreachable endpoint...")
    url = f"{baseURL}/foo_endpoint"
    
    # Στέλνουμε το αίτημα χωρίς την επικεφαλίδα X-OBSERVATORY-AUTH
    start_time = time.time()
    response = requests.get(url)
    end_time = time.time()

    # Μέτρηση του χρόνου απόκρισης
    response_time = end_time - start_time
    print(f"Response time for request to unreachable endpoint: {response_time:.4f} seconds")
    
    assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    print(f"Got expected response status code: {response.status_code}")



login_invalid_credentials()
token = login_valid_credentials()
request_without_token()
restricted_endpoint(token)
request_with_token(token)
request_with_short_parameters(token)
request_with_false_parameters(token)
no_endpoint()
