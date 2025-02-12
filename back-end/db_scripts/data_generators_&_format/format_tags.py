# Import των απαραίτητων βιβλιοθηκών
import pandas as pd

# Χάρτης αντιστοίχισης tagHomeID  -> op_pk
OP_PK_MAPPING = {
    'NAO': 1, 'OO': 2, 'EG': 3, 'NO': 4,
    'KO': 5, 'MO': 6, 'GE': 7, 'AM': 8
}

# Διαβάζουμε το αρχείο CSV
csv_file_path = 'passes-sample.csv'  # Αντικαταστήστε με τη διαδρομή του αρχείου σας
data = pd.read_csv(csv_file_path)

# Διατήρηση μόνο των απαραίτητων στηλών (tagRef, tagHomeID)
tags_data = data[['tagRef', 'tagHomeID']].drop_duplicates()

# Προσθήκη της τιμής op_pk με βάση το tagHomeID
tags_data['op_pk'] = tags_data['tagHomeID'].map(OP_PK_MAPPING)

# Έλεγχος για τυχόν μη αντιστοιχισμένα tagHomeID
if tags_data['op_pk'].isnull().any():
    print("Υπάρχουν tagHomeID που δεν αντιστοιχούν σε op_pk:")
    print(tags_data[tags_data['op_pk'].isnull()])
    raise ValueError("Μη έγκυρα tagHomeID βρέθηκαν στο αρχείο.")

# Δημιουργία των SQL εντολών με κόμμα μετά την πρώτη
sql_commands = [
    f"('{row['tagRef']}', {row['op_pk']})"
    for _, row in tags_data.iterrows()
]

# Δημιουργία της πρώτης εντολής με INSERT INTO και μετά τις επόμενες εντολές με κόμμα
sql_query = "INSERT INTO tag (tag_id, op_pk) VALUES\n" + ",\n".join(sql_commands) + ";"

# Αποθήκευση σε αρχείο
output_file = 'insert_tags.sql'
with open(output_file, 'w') as file:
    file.write(sql_query)

print(f"SQL εντολές αποθηκεύτηκαν στο αρχείο: {output_file}")