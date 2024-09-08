namespace my.bookshop;
entity Authors {
    key ID: Integer;
    name: String;
    famousFor: String;
    nationality: String;
    gender: String;
    imageUrl: String;
}

entity Genres {
    key ID: Integer;
    genreName: String;
}

entity Books {
    key ID: Integer;
    title: String;
    description: String;
    price: Decimal(9,2);
    stock: Integer;
    discount : Integer; 
    finalPrice : Decimal(10,2);
    reviews: array of String;
    rating: Decimal(2,1);
    publisher: String;
    genre: Association to Genres;
    isbn: String;
    countryOfOrigin: String;
    language: String;
    author: Association to Authors;
    imageUrl: String;
}

entity Users {
    key username: String;
    password: String;
    email: String;
    firstName: String;
    lastName: String;
    admin: Boolean;
}


entity Orders {
    key ID: Integer;
    orderDate: DateTime;
    totalAmount: Decimal(10,2);
    status: String;
    user: Association to Users;
}

entity OrderItems {
    key ID: Integer;
    quantity: Integer;
    price: Decimal(10,2);
    order: Association to Orders;
    book: Association to Books;
}
