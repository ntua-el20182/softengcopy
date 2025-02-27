create table operator (
	op_pk int not null auto_increment,
    op_id varchar(5) not null unique,
    op_name varchar(256) not null unique,
    email varchar(256) not null unique, /*regexp*/
    primary key (op_pk)
);

create table user (
	user_id int not null auto_increment,
    op_pk int default null,
    u_name varchar(256) not null,
    username varchar(256) not null unique,
    password varchar(256) not null,
    role enum('op_user', 'data_analyst', 'admin') not null,
    email varchar(256) not null unique,
    active bool not null default 1,
    primary key (user_id),
    foreign key (op_pk) references operator (op_pk) on update cascade on delete cascade
);

create table tag (
	tag_pk int not null auto_increment,
    tag_id varchar(15) not null unique, check (tag_id regexp '^[A-Z0-9-]+$'),
    op_pk int not null,
    primary key (tag_pk),
    foreign key (op_pk) references operator (op_pk) on update cascade on delete cascade
);

create table charges (
	char_id int not null auto_increment,
    creditor_id int not null,
    debtor_id int not null,
    amount decimal(15,2) not null, check (amount >= 0),
    status enum('owed', 'paid', 'confirmed') not null default 'owed',
    date_created timestamp default current_timestamp,
    date_paid timestamp default null, 
    primary key (char_id),
    foreign key (creditor_id) references operator (op_pk) on update cascade on delete cascade,
    foreign key (debtor_id) references operator (op_pk) on update cascade on delete cascade
);

create table toll (
	toll_pk int not null auto_increment,
    op_pk int not null,
    toll_id varchar(10) not null unique, check (toll_id regexp '^[A-Z0-9-]+$'),
    name varchar(256) not null,
    coord_lat decimal(7,5) not null,
    coord_long decimal(7,5) not null,
    dest varchar(256) not null,
    locality varchar(256) not null, 
    road varchar(256) not null,
    price1 decimal(4,2) not null, check (price1 >= 0),
    price2 decimal(4,2) not null, check (price2 >= 0),
    price3 decimal(4,2) not null, check (price3 >= 0),
    price4 decimal(4,2) not null, check (price4 >= 0),
    primary key (toll_pk),
    foreign key (op_pk) references operator (op_pk) on update cascade on delete cascade
);

create table pass (
	pass_id int not null auto_increment,
	toll_pk int not null,
    tag_pk int not null,
    vehicle_type enum('Cat1', 'Cat2', 'Cat3', 'Cat4') not null,
    amount decimal(4,2) not null,
    date_occured timestamp not null,
    date_received timestamp not null default current_timestamp,
    primary key (pass_id),
    foreign key (toll_pk) references toll (toll_pk) on update cascade on delete cascade,
    foreign key (tag_pk) references tag (tag_pk) on update cascade on delete cascade
);    