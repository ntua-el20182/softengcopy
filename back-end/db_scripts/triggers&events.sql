/* ---------------- TRIGGERS ------------------------
-----------------------------------------------------*/

DELIMITER $$
create trigger check_price_order
before insert on toll
for each row
begin
    -- Check if price1 <= price2 <= price3 <= price4 for the new row
    if new.price1 > new.price2 OR new.price1 > new.price3 OR new.price1 > new.price4 OR
	   new.price2 > new.price3 OR new.price2 > new.price4 OR 
	   new.price3 > new.price4 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Prices must be in ascending order!';
    end if;
end$$
DELIMITER ;

DELIMITER $$
create trigger checks_on_pass
before insert on pass
for each row
begin
	declare inferred_vehicle_type enum('Cat1', 'Cat2', 'Cat3', 'Cat4');
    declare toll_operator int;
    declare tag_operator int;

    -- Βρίσκουμε τους operators του σταθμού διοδίων και του tag
    select op_pk into toll_operator from toll where toll_pk = new.toll_pk;
	select op_pk into tag_operator from tag where tag_pk = new.tag_pk;

    -- Ελέγχουμε αν ο operator του tag είναι ο ίδιος με τον operator του σταθμού διοδίων
    -- IF toll_operator = tag_operator THEN
    --    SIGNAL SQLSTATE '45000'
    --    SET MESSAGE_TEXT = 'Invalid pass: A pass should not be considered with a tag from the same operator as the toll.';
    -- END IF;
    
	/* Check the given vehicle type */
	-- Διασταύρωση του amount με τις τιμές στον πίνακα toll
	select case
		when new.amount = t.price1 then 'Cat1'
		when new.amount = t.price2 then 'Cat2'
		when new.amount = t.price3 then 'Cat3'
		when new.amount = t.price4 then 'Cat4'
		else null
	end
	into inferred_vehicle_type
	from toll t
	where t.toll_pk = new.toll_pk;

    -- Έλεγχος αν βρέθηκε αντιστοιχία
	if inferred_vehicle_type is null then
		SIGNAL SQLSTATE '45000' 
		SET MESSAGE_TEXT = 'Unable to infer vehicle type based on amount and toll';
	end if;

	-- Έλεγχος όταν το vehicle_type είναι NULL
	if new.vehicle_type is null then
		set new.vehicle_type = inferred_vehicle_type;
	else
    -- Έλεγχος όταν το vehicle_type έχει δοθεί
		if new.vehicle_type != inferred_vehicle_type then
			SIGNAL SQLSTATE '45000'
			SET MESSAGE_TEXT = 'Mismatch between given vehicle type and inferred vehicle type based on toll and amount';
		end if;
	end if;
    
    
    
    /* Check for duplicate records */
    if exists (select 1 from pass where tag_pk = new.tag_pk and date_occured = new.date_occured) 
		then SIGNAL SQLSTATE '45000'
		SET MESSAGE_TEXT = 'Duplicate pass detected: A pass with the same tag and timestamp already exists.';
	end if;



	/* Pass is not in the future */
    if new.date_occured > current_timestamp then
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'You cannot pass a toll in the future!';
    end if;
end$$
DELIMITER ;

DELIMITER $$
create trigger date_paid
before update on charges
for each row
begin
	-- Ελέγχει αν η κατάσταση αλλάζει από 'owed' σε 'paid'
    if old.status = 'owed' and new.status = 'paid' then
        set new.date_paid = current_timestamp;
    end if;
end$$
DELIMITER ;

/* ---------------- EVENTS ------------------------
---------------------------------------------------*/

DELIMITER $$
create event calculate_charges
on schedule every 1 week
starts current_timestamp
do
begin
    -- Εισάγουμε όλες τις εγγραφές στον πίνακα charges
    insert into charges (creditor_id, debtor_id, amount)
    select
        t.op_pk as creditor_id,
        tg.op_pk as debtor_id,
        sum(p.amount) as amount
    from pass p
    inner join tag tg on p.tag_pk = tg.tag_pk
    inner join toll t on p.toll_pk = t.toll_pk
    where p.date_received >= DATE_SUB(current_timestamp, interval 1 week)
		and t.op_pk != tg.op_pk -- Εξασφαλίζουμε ότι δεν είναι ίδιος ο creditor με τον debtor
    group by t.op_pk, tg.op_pk;
end$$
DELIMITER ;