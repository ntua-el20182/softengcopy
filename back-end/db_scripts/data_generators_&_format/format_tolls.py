# Import των απαραίτητων βιβλιοθηκών
import pandas as pd

# Χάρτης αντιστοίχισης OpID -> op_pk
OP_PK_MAPPING = {
    'NAO': 1, 'OO': 2, 'EG': 3, 'NO': 4,
    'KO': 5, 'MO': 6, 'GE': 7, 'AM': 8
}

# Διαβάζουμε το αρχείο CSV
csv_file_path = 'tollstations2024.csv'  # Αντικαταστήστε με τη διαδρομή του αρχείου σας
data = pd.read_csv(csv_file_path)

# Διατήρηση μόνο των απαραίτητων στηλών
tolls_data = data[['OpID', 'TollID', 'Name', 'Locality', 'Road', 'Lat', 'Long',
                   'Price1', 'Price2', 'Price3', 'Price4']].drop_duplicates()
tolls_data['op_pk'] = tolls_data['OpID'].map(OP_PK_MAPPING)

# Εξαγωγή της κατεύθυνσης και δημιουργία νέας στήλης 'Direction'
tolls_data['Direction'] = tolls_data['Name'].str.extract(r'\((.*?)\)', expand=False)
# Αφαίρεση της παρένθεσης από το όνομα
tolls_data['Name'] = tolls_data['Name'].str.replace(r'\(.*\)', '', regex=True)

# Έλεγχος για τυχόν μη αντιστοιχισμένα OpID
if tolls_data['op_pk'].isnull().any():
    print("Υπάρχουν OpID που δεν αντιστοιχούν σε op_pk:")
    print(tolls_data[tolls_data['op_pk'].isnull()])
    raise ValueError("Μη έγκυρα OpID βρέθηκαν στο αρχείο.")

# Δημιουργία των SQL εντολών
sql_commands = [
    f"('{row['op_pk']}', '{row['TollID']}', '{row['Name']}', {row['Lat']}, {row['Long']}, '{row['Direction']}', '{row['Locality']}', '{row['Road']}', {row['Price1']}, {row['Price2']}, {row['Price3']}, {row['Price4']})"
    for _, row in tolls_data.iterrows()
]

# Δημιουργία της πρώτης εντολής με INSERT INTO και μετά τις επόμενες εντολές με κόμμα
sql_query = "INSERT INTO toll (op_pk, toll_id, name, coord_lat, coord_long, dest, locality, road, price1, price2, price3, price4) VALUES\n" + ",\n".join(sql_commands) + ";"

# Αποθήκευση σε αρχείο
output_file = 'insert_tolls.sql'
with open(output_file, 'w') as file:
    file.write(sql_query)

print(f"SQL εντολές αποθηκεύτηκαν στο αρχείο: {output_file}")