# Import των απαραίτητων βιβλιοθηκών
import pandas as pd

# Χάρτης αντιστοίχισης tagHomeID -> op_pk
OP_PK_MAPPING = {
    'NAO': 1, 'OO': 2, 'EG': 3, 'NO': 4,
    'KO': 5, 'MO': 6, 'GE': 7, 'AM': 8
}

# Διαβάζουμε το αρχείο CSV
csv_file_path = 'passes-sample.csv'  # Αντικαταστήστε με τη διαδρομή του αρχείου σας
data = pd.read_csv(csv_file_path)

# Διατήρηση μόνο των απαραίτητων στηλών
passes_data = data[['timestamp', 'tollID', 'tagRef', 'tagHomeID', 'charge']].drop_duplicates()

passes_data['timestamp'] = pd.to_datetime(passes_data['timestamp'])
passes_data['timestamp'] = passes_data['timestamp'] + pd.DateOffset(years=2)

# Διαβάζουμε το αρχείο CSV
csv_file_path = 'toll_data.csv'  # Αντικαταστήστε με τη διαδρομή του αρχείου σας (δεδομένα διοδίων από την βάση)
data = pd.read_csv(csv_file_path)

# Διατήρηση μόνο των απαραίτητων στηλών
tolls_pk_data = data[['toll_pk', 'toll_id']].drop_duplicates()

# Συγχώνευση των δεδομένων από το passes_data και το tolls_pk_data με βάση την στήλη tollID
passes_data = passes_data.merge(tolls_pk_data, how='left', left_on='tollID', right_on='toll_id')

# Διαβάζουμε το αρχείο CSV
csv_file_path = 'tag_data.csv'  # Αντικαταστήστε με τη διαδρομή του αρχείου σας (δεδομένα tag από την βάση)
data = pd.read_csv(csv_file_path)

# Διατήρηση μόνο των απαραίτητων στηλών
tags_pk_data = data[['tag_pk', 'tag_id']].drop_duplicates()

# Συγχώνευση των δεδομένων από το passes_data και το tolls_pk_data με βάση την στήλη tollID
passes_data = passes_data.merge(tags_pk_data, how='left', left_on='tagRef', right_on='tag_id')

# Εμφάνιση των πρώτων γραμμών του passes_data για έλεγχο
print(passes_data.head())

# Δημιουργία της νέας στήλης 'received' που να αντιστοιχεί στη μεσάνυχτα της επόμενης μέρας
passes_data['received'] = (passes_data['timestamp'] + pd.Timedelta(days=1)).dt.normalize()

# Μετατροπή της στήλης 'received' σε τύπο datetime, προσθέτοντας την ώρα 00:00:01
passes_data['received'] = pd.to_datetime(passes_data['received'].astype(str) + " 00:00:01")


# Δημιουργία των SQL εντολών
sql_commands = [
    f"({row['toll_pk']}, {row['tag_pk']}, {row['charge']}, '{row['timestamp']}', '{row['received']}')"
    for _, row in passes_data.iterrows()
]

# Δημιουργία της πρώτης εντολής με INSERT INTO και μετά τις επόμενες εντολές με κόμμα
sql_query = "INSERT INTO pass (toll_pk, tag_pk, amount, date_occured, date_received) VALUES\n" + ",\n".join(sql_commands) + ";"

# Αποθήκευση σε αρχείο
output_file = 'insert_passes.sql'
with open(output_file, 'w') as file:
    file.write(sql_query)

print(f"SQL εντολές αποθηκεύτηκαν στο αρχείο: {output_file}")