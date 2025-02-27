# Εισαγωγή των απαραίτητων βιβλιοθηκών
import networkx as nx
import matplotlib.pyplot as plt
import random
from datetime import datetime, timedelta
import pandas as pd

toll_network = nx.DiGraph()

tolls = [ # Αυτοκινητόδρομος Αιγαίου
         "AM01", "AM02", "AM03", "AM04", "AM05", "AM06", "AM07", "AM08", "AM09", "AM10",
         # Εγνατία Οδός
         "EG01", "EG02", "EG03", "EG04", "EG05", "EG06", "EG07", "EG08", "EG09", "EG10",
         "EG11", "EG12", "EG13", "EG14", "EG15", "EG16", "EG17", "EG18", "EG19", "EG20",
         "EG21", "EG22", "EG23", "EG24", "EG25", "EG26", "EG27", "EG28", "EG29", "EG30",
         "EG31", "EG32", "EG33", "EG34", "EG35", "EG36", "EG37", "EG38",
         # Γέφυρα
         "GE01", "GE02",
         # Κεντρική Οδός
         "KO01", "KO02", "KO03", "KO04", "KO05", "KO06", "KO07", "KO08", "KO09", "KO10",
         # Μορέας
         "MO01", "MO02", "MO03", "MO04", "MO05", "MO06", "MO07", "MO08", "MO09", "MO10",
         "MO11", "MO12", "MO15", "MO16",
         # Αττική Οδός
         #"NAO01", ..., "NAO41",
         "NAO",
         # Νέα Οδός
         "NO01", "NO02", "NO03", "NO04", "NO05", "NO06", "NO07", "NO08", "NO09", "NO10",
         "NO11", "NO12", "NO13", "NO14",
         # Ολυμπία Οδός
         "OO01", "OO02", "OO03", "OO04", "OO05", "OO06", "OO07", "OO08", "OO09", "OO10"]

# Στην Αττική Οδό, ο οδηγός πληρώνει διόδια μία φορά κατά την είσοδο του σε αυτή.
# Επομένως, στον γράφο θα αντιπροσωπεύεται από έναν μόνο κόμβο ("ΝΑΟ"), στον οποίο, αν συμπεριληφθεί
# στο τυχαίο μονοπάτι, θα ανατίθεται τυχαία κάποιος υπαρκτός σταθμός διοδίων της Ατιικής Οδού.

toll_network.add_nodes_from(tolls)

distances = [
    # Μετωπικά διόδια
    # Μορέας
    ("MO12", "MO02", 29.4), ("MO02", "MO04", 22.4), ("MO04", "MO06", 26), ("MO06", "MO10", 46.8),
                            ("MO07", "MO04", 29.1),
    ("MO09", "MO05", 46.8), ("MO05", "MO03", 26), ("MO03", "MO01", 22.4),  ("MO01","MO11", 29.4),
                                                  ("MO03", "MO08", 29.1),

    ("MO10", "OO10", 33.6), ("MO10", "OO07", 25), ("OO09", "MO09", 33.6), ("OO08", "MO09", 25),

    # Ολυμπία Οδός
    ("OO03", "OO05", 36), ("OO05", "OO09", 59), ("OO09", "OO07", 31.9), ("OO07", "OO01", 45.9),
    ("OO02", "OO08", 45.9), ("OO08", "OO10", 31.9), ("OO10", "OO06", 59), ("OO06", "OO04", 36),

    ("GE02", "OO03", 8.5), ("OO04", "GE01", 8.5), ("OO01", "NAO", 2.5), ("NAO", "OO02", 2.5),
    ("NAO", "NO08", 16.7), ("NO07", "NAO", 16.7),
    ("GE01", "NO03", 10.7), ("NO04", "GE02", 10.7),

    # Νέα Οδός
    ("NO08", "NO10", 60.7), ("NO10", "NO14", 42.6), ("NO13", "NO09", 42.6), ("NO09", "NO07", 60.7),
    ("NO03", "NO01", 46.1), ("NO01", "NO05", 54.7), ("NO05", "NO11", 63.6), ("NO12", "NO06", 63.6), ("NO06", "NO02", 54.7), ("NO02", "NO04", 46.1),
    ("NO01", "EG02", 77.7), ("EG02", "NO11", 77.6), ("NO12", "EG01", 77.6), ("EG01", "NO02", 77.7),

    ("NO14", "KO06", 59.2), ("KO05", "NO13", 59.2),
    ("NO11", "EG18", 38.5), ("NO11", "EG15", 34.3), ("EG17", "NO12", 38.5), ("EG16", "NO12", 34.3),

    # Κεντρική Οδός
    ("KO06", "KO10", 24.9), ("KO09", "KO05", 24.9),
    ("KO06", "KO08", 28.4), ("KO08", "KO02", 49.2), ("KO02", "KO04", 39.5), ("KO03", "KO01", 39.5), ("KO01", "KO07", 49.2), ("KO07", "KO05", 28.4),
    ("KO09", "KO08", 21.6), ("KO07", "KO10", 21.6),

    ("KO10", "AM10", 33.2), ("AM09", "KO09", 33.2),
    ("KO04", "EG38", 77.8), ("EG37", "KO03", 77.8), ("KO04", "EG29", 121), ("EG30", "KO03", 121), ("KO04", "EG23", 176), ("EG24", "KO03", 176),

    # Αυτοκινητόδρομος Αιγαίου
    ("AM10", "AM06", 87.4), ("AM06", "AM04", 38.1), ("AM04", "AM08", 35), ("AM08", "AM02", 57.8),
    ("AM01", "AM07", 57.8), ("AM07", "AM03", 35), ("AM03", "AM05", 38.1), ("AM05", "AM09", 87.4),

    ("AM02", "EG28", 65.8), ("EG27", "AM01", 65.8), ("AM02", "EG14", 14.7), ("EG13", "AM01", 14.7),

    # Εγνατία Οδός
    ("EG17", "EG15", 30), ("EG15", "EG37", 40.6), ("EG37", "EG29", 68), ("EG29", "EG27", 42), ("EG27", "EG14", 70.4), ("EG14", "EG11", 23.2), ("EG11", "EG07", 27.6), ("EG07", "EG09", 46.7), ("EG09", "EG21", 46.5), ("EG21", "EG19", 35.9), ("EG19", "EG31", 59.6), ("EG31", "EG05", 45.8), ("EG05", "EG04", 65.7),
    ("EG03", "EG06", 65.7), ("EG06", "EG32", 45.8), ("EG32", "EG20", 59.6), ("EG20", "EG22", 35.9), ("EG22", "EG10", 46.5), ("EG10", "EG08", 46.7), ("EG08", "EG12", 27.6), ("EG12", "EG13", 23.2), ("EG13", "EG28", 70.4), ("EG28", "EG30", 42), ("EG30", "EG38", 68), ("EG38", "EG16", 40.6), ("EG16", "EG18", 30),
    ("EG24", "EG29", 69.9), ("EG30", "EG23", 69.9), ("EG24", "EG38", 122), ("EG37", "EG23", 122),
    ("EG25", "EG13", 62.1), ("EG14", "EG26", 62.1), ("EG25", "EG11", 62), ("EG12", "EG26", 62),
    ("EG34", "EG35", 49.9), ("EG36", "EG33", 49.9),
    ("EG35", "EG12", 57.4), ("EG11", "EG36", 57.4), ("EG35", "EG07", 61.1), ("EG08", "EG36", 61.1)
]

toll_network.add_weighted_edges_from(distances)

# Λίστα με πλευρικά διόδια
# πλευρικά διόδια εξόδου (<μετώπικο που προηγείται αμέσως πριν>: (<πλευρικό>, <απόσταση>))
exit = {
    # Αυτοκινητόδρομος Αιγαίου
    'AM10': [('AM15', 80.7),  ('AM18', 72.7), ('AM22', 67.3)], 'AM01': ('AM25', 56.9),
    'AM06': [('AM11', 32), ('AM17', 37.7)],'AM07': ('AM13', 32.2), 'AM04': ('AM27', 27.1), 'AM05': ('AM29', 82.6),
    'AM09': [('KO19', 30.8), ('KO25', 22.4)],

    # Εγνατία Οδός
    'EG03': ('EG39', 62.6), 'EG10': [('EG41', 30.7), ('EG48', 40.9), ('EG61', 53.5)], 'EG12': [('EG43', 14), ('EG44', 14)],
    'EG07': ('EG46', 47.4), 'EG20': [('EG50', 35.8), ('EG54', 36.7)], 'EG21': ('EG52', 37.5), 'EG09': [('EG56', 46.5), ('EG58', 27.4)],
    'EG14': ('EG61', 55.5), 'EG28': ('EG62', 42.7), 'EG37': ('EG64', 68), 'EG19': [('EG66', 45.8), ('EG67', 45.8)], 'EG06': ('EG70', 45.8),
    'EG31': ('EG72', 36.2), 'EG17': ('EG74', 70.5),

    # Κεντρική Οδός
    'KO08': ('KO11', 44.5), 'KO02': ('KO13', 31.7), 'KO04': ('KO15', 31.9), 'KO01': ('KO17', 58.9), 'KO09': ('KO21', 17), 'KO05': ('NO33', 57.5),

    # Μορέας
    'MO03': ('MO13', 49.6), 'MO12': ('MO17', 26.5),

    # Νέα Οδός
    'NO14': ('KO23', 54.7), 'NO04': ('NO15', 3.2), 'NO02': ('NO17', 30.4), 'NO06': ('NO19', 35.8), 'NO12': ('NO21', 39.6),
    'NO09': [('NO23', 57.9), ('NO25', 50), ('NO29', 37.8)], 'NO13': ('NO27', 46.8),
    'NO05': ('NO31', 52.5),

    # Ολυμπία Οδός
    'OO07': [('OO11', 39.2), ('OO13', 31.1)], 'OO06': ('OO15', 33.7), 'OO02': ('OO21', 39.2),
    'OO10': [('OO17', 42.1), ('OO19', 52.7), ('OO23', 37.3)], 'OO08': ('OO25', 24.6), 'OO05': ('OO27', 58.1)
}


# πλευρικά διόδια εισόδου (<μετώπικο που έπεται αμέσως μετά>: (<πλευρικό>, <απόσταση>))
entrance = {
    # Αυτοκινητόδρομος Αιγαίου
    'AM08': [('AM21', 20.8), ('AM14', 32.2)], 'AM05': ('AM12', 32), 'AM06': ('AM30', 82.6),
    'AM03': [('AM20', 18.2), ('AM28', 27.1)], 'AM02': ('AM26', 56.9), 'AM10': [('KO20', 30.8), ('KO26', 22.4)],
    'AM09': [('AM23', 67.3), ('AM16', 80.7), ('AM24', 67.3), ('AM19', 72.7)],

    # Εγνατία Οδός
    'EG04': ('EG40', 62.6), 'EG09': [('EG42', 30.7), ('EG49', 40.9), ('EG60', 53.5)], 'EG11': ('EG45', 14), 'EG08': ('EG47', 47.4),
    'EG19': [('EG51', 35.8), ('EG55', 36.7), ], 'EG22': ('EG53', 37.5), 'EG10': [('EG57', 46.5), ('EG59', 27.4)], 'EG13': ('EG60', 55.5),
    'EG27': ('EG63', 42.7), 'EG38': ('EG65', 68), 'EG20': [('EG68', 45.8), ('EG69', 45.8)], 'EG05': ('EG71', 45.8), 'EG32': ('EG73', 36.2),

    # Κεντρική Οδός
    'KO07': ('KO12', 44.5), 'KO01': ('KO14', 31.7), 'KO03': ('KO16', 31.9), 'KO02': ('KO18', 58.9), 'KO10': ('KO22', 17), 'KO06': ('NO34', 57.5),

    # Μορέας
    'MO04': ('MO14', 54.7), 'MO11': ('MO18', 26.5),

    # Νέα Οδός
    'NO13': ('KO24', 54.7), 'NO03': ('NO16', 3.2), 'NO01': ('NO18', 30.4), 'NO05': ('NO20', 35.8), 'NO11': ('NO22', 39.6),
    'NO10': [('NO24', 57.9), ('NO26', 50), ('NO30', 37.8)], 'NO14': ('NO28', 46.8), 'NO06': ('NO32', 52.5),

    # Ολυμπία Οδός
    'OO08': [('OO12', 39.2), ('OO14', 31.1)], 'OO05': ('OO16', 33.7), 'OO01': ('OO22', 39.2),
    'OO09': [('OO18', 42.1), ('OO20', 52.7), ('OO24', 37.3)], 'OO07': ('OO26', 24.6), 'OO06': ('OO28', 58.1)
}

# Γεννήτρια timestamp
def generate_random_datetime(start, end):
    delta = end - start
    random_seconds = random.randint(0, int(delta.total_seconds()))
    return start + timedelta(seconds=random_seconds)

def get_valid_date(timestamp):
    try:
        # Προσπάθησε να προσθέσεις 1 μέρα στο timestamp
        received = timestamp + pd.Timedelta(days=1)

        # Έλεγχος αν η ημερομηνία είναι έγκυρη
        pd.to_datetime(received)
        return received.replace(hour=0, minute=0, second=1, microsecond=0)
    except ValueError:
        # Αν η ημερομηνία δεν είναι έγκυρη, αύξησε τον μήνα κατά 1 και βάλε την ημέρα σε 1
        next_month = timestamp + pd.DateOffset(months=1)
        received = next_month.replace(day=1, hour=0, minute=0, second=1, microsecond=0)
        return received
    
# Συνάρτηση για την επιλογή πλευρικών διοδίων
def select_side_toll(main_toll, side_tolls):
    if main_toll in side_tolls:
        toll_options = side_tolls[main_toll]
        if isinstance(toll_options, list):  # Πολλαπλές επιλογές
            return random.choice(toll_options)
        else:  # Μία επιλογή
            return toll_options
    return None

# Ταχύτητες ανά κατηγορία οχήματος (σε μονάδες απόστασης/ώρα)
vehicle_speeds = { "Motorcycle": 110, "Car": 90, "Bus": 80, "Truck": 70 }
vehicle_prices = { "Motorcycle": "price1", "Car": "price2", "Bus": "price3", "Truck": "price4" }
n = 1000  # Αριθμός ταξιδιών
max_length = 16  # Μέγιστο πλήθος διοδίων

# Φόρτωση του CSV με τα δεδομένα
tag_df = pd.read_csv("tag_data.csv")
tag_data = tag_df[['tag_pk', 'op_pk']]

toll_df = pd.read_csv("toll_data.csv")
toll_data = toll_df[['toll_pk', 'op_pk', 'toll_id', 'price1', 'price2', 'price3', 'price4']]

routes = []
for _ in range(n):
    # Επιλογή τυχαίας κατηγορίας οχήματος
    vehicle_type = random.choice(list(vehicle_speeds.keys()))
    avg_speed = vehicle_speeds[vehicle_type]
    price_column = vehicle_prices[vehicle_type]
    trip = []

    # Επιλογή τυχαίας αρχικής ημερομηνίας και ώρας
    start_datetime = generate_random_datetime(datetime(2024, 1, 15), datetime(2025, 1, 4))
    start_node = random.choice(list(toll_network.nodes))
    current_time = start_datetime
    current_node = start_node

    # Πλευρικά διόδια εισόδου
    entrance_toll = select_side_toll(start_node, entrance)
    if entrance_toll:
        entry_node, distance = entrance_toll
        toll_row = toll_data[toll_data['toll_id'] == entry_node]
        trip.append((entry_node, toll_row['toll_pk'].iloc[0], toll_row['op_pk'].iloc[0],
                     current_time.strftime("%Y-%m-%d %H:%M:%S"), toll_row[price_column].iloc[0]))
        time_from_toll = timedelta(hours=distance / avg_speed)
        current_time += time_from_toll

    if current_node == "NAO":
      virtual_node = f"NAO{random.randint(1, 41):02}"
    else :
      virtual_node = current_node
    toll_row = toll_data[toll_data['toll_id'] == virtual_node]
    trip.append((virtual_node, toll_row['toll_pk'].iloc[0], toll_row['op_pk'].iloc[0],
                 current_time.strftime("%Y-%m-%d %H:%M:%S"), toll_row[price_column].iloc[0]))

    while len(trip) < max_length:
        neighbors = list(toll_network.neighbors(current_node))

        if not neighbors:
            break
        if random.random() < 0.15:  # Τυχαία απόφαση για να σταματήσει
            break

        next_node = random.choice(neighbors)
        distance = toll_network[current_node][next_node].get("weight", 1)
        time_to_next = timedelta(hours=distance / avg_speed)  # Χρόνος διαδρομής
        current_time += time_to_next  # Ενημέρωση της τρέχουσας ώρας
        if next_node == "NAO":
          virtual = f"NAO{random.randint(1, 41):02}"
          toll_row = toll_data[toll_data['toll_id'] == virtual]
          trip.append((virtual, toll_row['toll_pk'].iloc[0], toll_row['op_pk'].iloc[0],
                       current_time.strftime("%Y-%m-%d %H:%M:%S"), toll_row[price_column].iloc[0]))
        else:
          toll_row = toll_data[toll_data['toll_id'] == next_node]
          trip.append((next_node, toll_row['toll_pk'].iloc[0], toll_row['op_pk'].iloc[0],
                       current_time.strftime("%Y-%m-%d %H:%M:%S"), toll_row[price_column].iloc[0]))
        current_node = next_node

    # Πλευρικά διόδια εξόδου
    exit_toll = select_side_toll(current_node, exit)
    if exit_toll:
        exit_node, distance = exit_toll
        time_to_toll = timedelta(hours=distance / avg_speed)
        current_time += time_to_toll
        toll_row = toll_data[toll_data['toll_id'] == exit_node]
        trip.append((exit_node, toll_row['toll_pk'].iloc[0], toll_row['op_pk'].iloc[0],
                     current_time.strftime("%Y-%m-%d %H:%M:%S"), toll_row[price_column].iloc[0]))

    # Επιλογή τυχαίας εγγραφής από τα tags
    random_tag = tag_data.sample(n=1).iloc[0]
    tag_pk, tag_op_pk = random_tag["tag_pk"], random_tag["op_pk"]

    routes.append({"trip": trip, "tag_pk": tag_pk, "tag_op_pk": tag_op_pk})

final_passes = []

for route in routes:
    for toll in route['trip']:
        timestamp = pd.to_datetime(toll[3])
        received = get_valid_date(timestamp)

        final_passes.append({'toll_pk': toll[1], 'timestamp': timestamp, 'amount': toll[4],
                            'tag_pk': route['tag_pk'], 'received': received})

final_passes_df = pd.DataFrame(final_passes)

# Δημιουργία των SQL εντολών
sql_commands = [
    f"({row['toll_pk']}, {row['tag_pk']}, {row['amount']}, '{row['timestamp']}', '{row['received']}')"
    for _, row in final_passes_df.iterrows()
]

# Δημιουργία της πρώτης εντολής με INSERT INTO και μετά τις επόμενες εντολές με κόμμα
sql_query = "INSERT INTO pass (toll_pk, tag_pk, amount, date_occured, date_received) VALUES\n" + ",\n".join(sql_commands) + ";"

# Αποθήκευση σε αρχείο
output_file = 'insert_passes.sql'
with open(output_file, 'w') as file:
    file.write(sql_query)

print(f"SQL εντολές αποθηκεύτηκαν στο αρχείο: {output_file}")