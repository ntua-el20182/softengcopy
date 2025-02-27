import pandas as pd
from datetime import datetime, timedelta
import random

# Φόρτωση του csv αρχείου στο dataframe
filename = "passes_data.csv"
data = pd.read_csv(filename)

# Μετατροπή της στήλης date_occured σε datetime
data['date_received'] = pd.to_datetime(data['date_received'])
# Εξαγωγή του μήνα από τη στήλη date_occured
data['date_created'] = data['date_received'].dt.to_period('W').apply(lambda r: (r.end_time).strftime('%Y-%m-%d %H:%M:%S'))

# Δημιουργία μιας νέας στήλης που αντιπροσωπεύει το ζεύγος εταιριών ως tuple
# Θα χρησιμοποιήσουμε το "sorted" για να διασφαλίσουμε ότι τα ζεύγη είναι πάντα με τη μικρότερη τιμή πρώτα
# αλλά μόνο για διαφορές εταιριών (α, β) ≠ (β, α)
data['pair'] = data.apply(lambda row: tuple(([row['tag_op_pk'], row['toll_op_pk']])), axis=1)

# Ομαδοποίηση με βάση το ζεύγος και υπολογισμός της συνολικής χρέωσης
result = data.groupby(['pair', 'date_created'])['amount'].sum().reset_index()

# Μετατροπή του ζεύγους σε ξεχωριστές στήλες για debtor και creditor
result[['Debtor ID', 'Creditor ID']] = pd.DataFrame(result['pair'].tolist(), index=result.index)
result.drop(columns=['pair'], inplace=True)

# Μετονομασία της στήλης amount
result.rename(columns={'amount': 'Total Charge'}, inplace=True)

# Αναδιάταξη των στηλών για την τελική μορφή
result = result[['Debtor ID', 'Creditor ID', 'date_created', 'Total Charge']]

# Προσθήκη της στήλης status
# Λαμβάνουμε την τρέχουσα ημερομηνία
current_date = datetime.now()

# Ορισμός του status
def assign_status(row):
    date_created = pd.to_datetime(row['date_created'])

    # Αν η συναλλαγή έγινε τις τελευταίες 2 εβδομάδες, είναι owed
    if date_created >= current_date - timedelta(weeks=2):
        p = random.random()
        return 'owed' if p < 0.4 else 'paid' if p < 0.7 else 'confirmed'
    # Αν η συναλλαγή έγινε το τελευταίο μήνα, αποφασίζουμε αν θα είναι paid ή confirmed
    elif date_created >= current_date - timedelta(days=30):
        # Με πιθανότητα 80% θα είναι 'paid' και 20% 'confirmed'
        return 'paid' if random.random() < 0.4 else 'confirmed'
    # Για παλαιότερες συναλλαγές, είναι confirmed
    else:
        return 'confirmed'

result['status'] = result.apply(assign_status, axis=1)

# Προσθήκη της στήλης date_paid
def assign_date_paid(row):
    if row['status'] == 'owed':
        return None
    else:
        date_created = pd.to_datetime(row['date_created'])
        max_date = min(current_date, date_created + timedelta(weeks=2))  # Μέγιστη ημερομηνία: 2 εβδομάδες μετά το date_created ή η σημερινή ημερομηνία
        # Αν το max_date είναι μετά την τρέχουσα ημερομηνία, τότε βάζουμε μία τυχαία ημερομηνία
        date_paid = date_created + (max_date - date_created) * random.random()
        return date_paid.strftime('%Y-%m-%d %H:%M:%S')

result['date_paid'] = result.apply(assign_date_paid, axis=1)

# Δημιουργία των SQL εντολών
sql_commands = []
for _, row in result.iterrows():
    if pd.isna(row['date_paid']):
        sql_commands.append(f"({row['Debtor ID']}, {row['Creditor ID']}, '{row['date_created']}', {row['Total Charge']}, '{row['status']}', null)")
    else:
        sql_commands.append(f"({row['Debtor ID']}, {row['Creditor ID']}, '{row['date_created']}', {row['Total Charge']}, '{row['status']}', '{row['date_paid']}')")

# Δημιουργία της πρώτης εντολής με INSERT INTO και μετά τις επόμενες εντολές με κόμμα
sql_query = "INSERT INTO charges (debtor_id, creditor_id, date_created, amount, status, date_paid) VALUES\n" + ",\n".join(sql_commands) + ";"

# Αποθήκευση σε αρχείο
output_file = 'insert_charges.sql'
with open(output_file, 'w') as file:
    file.write(sql_query)

print(f"SQL εντολές αποθηκεύτηκαν στο αρχείο: {output_file}")