using my.bookshop as my from '../db/schema';

service CatalogService @(path: '/catalog') {
    entity Books @(Capabilities: {
        Insertable: true,
        Updatable : true,
        Deletable : true
    })                as projection on my.Books;

    entity Authors    as projection on my.Authors;
    entity Genres     as projection on my.Genres;

    @readonly
    entity Users      as projection on my.Users;

    entity Orders     as projection on my.Orders;
    entity OrderItems as projection on my.OrderItems;

    action login(username : String, password : String)                                                           returns {
        success : Boolean;
        username : String;
    };

    action register(username : String, password : String, email : String, firstName : String, lastName : String) returns {
        success : Boolean;
        message : String;
    };

    action placeOrder(username : String,
                      items : array of {
        bookId : Integer;
        quantity : Integer;
    })                                                                                                           returns {
        success : Boolean;
        message : String;
        orderId : Integer;
        bookNames : String;
    };

    action cancelOrder(orderId : Integer)                                                                        returns {
        success : Boolean;
        message : String;
    };

    action updateOrderStatus(orderId : Integer, newStatus : String)                                              returns {
        success : Boolean;
        message : String;
    };

    action fetchOrderHistory(bookId : Integer, username : String)                                                returns {
        success : Boolean;
        orders : array of {
            orderId : Integer;
            quantity : Integer;
            price : Decimal;
            status : String;
            orderDate : DateTime;
            bookTitle : String;
        };
        message : String;
    };

}
