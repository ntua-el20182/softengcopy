import random
import string

# Στατικά prefixes (OpID)
OpIDs = ["NAO", "OO", "EG", "NO", "KO", "MO", "GE", "AM"]
op_pk_mapping = { "NAO": 1, "OO": 2, "EG": 3, "NO": 4,
                  "KO": 5,  "MO": 6, "GE": 7, "AM": 8}
length = 10
num_tags = 200

generated_data = []

for _ in range(num_tags):
    # Επιλογή τυχαίου prefix
    prefix = random.choice(OpIDs)

    # Υπολογισμός του μήκους που απομένει
    remaining_length = length - len(prefix)

    # Δημιουργία του υπόλοιπου string με κεφαλαία γράμματα και αριθμούς
    suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=remaining_length))

    # Συνδυασμός prefix και suffix
    generated_string = prefix + suffix
    op_pk = op_pk_mapping[prefix]

    generated_data.append((generated_string, op_pk))

# Δημιουργία SQL εντολών
sql_commands = [
    f"('{tag}', {op_pk})"
    for tag, op_pk in generated_data
]

# Δημιουργία της πλήρους SQL ερώτησης
sql_query = "INSERT INTO tag (tag_id, op_pk) VALUES\n" + ",\n".join(sql_commands) + ";"

# Αποθήκευση σε αρχείο
output_file = 'generate_tags.sql'
with open(output_file, 'w') as file:
    file.write(sql_query)

print(f"SQL εντολές αποθηκεύτηκαν στο αρχείο: {output_file}")