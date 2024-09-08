const cds = require('@sap/cds');
const bcrypt = require('bcrypt');

module.exports = cds.service.impl(async function () {
    const { Books, Authors, Genres, Users, Orders, OrderItems } = this.entities;

    function calculateDiscount(stock) {
        if (stock > 100) return 10;
        if (stock > 50) return 5;
        return 0;
    }

    this.after('READ', 'Books', async (books, req) => {
        if (!Array.isArray(books)) books = [books];

        const updatedBooks = await Promise.all(books.map(async (book) => {
            if (book.stock !== undefined) {
                const discount = calculateDiscount(book.stock);
                book.discount = discount;
                book.finalPrice = parseFloat((book.price - (book.price * discount / 100)).toFixed(2));
                await UPDATE(Books)
                    .set({
                        discount: book.discount,
                        finalPrice: book.finalPrice
                    })
                    .where({ ID: book.ID });
            }
            return book;
        }));

        return Array.isArray(req.data) ? updatedBooks : updatedBooks[0];
    });


    this.on('CREATE', 'Books', async (req) => {
        const book = req.data;

        const maxIdResult = await SELECT.from(Books).columns('max(ID) as maxId');
        const newId = (maxIdResult[0].maxId || 0) + 1;
        book.ID = newId;

        // Validate and set associations
        const authorExists = await SELECT.one.from(Authors).where({ ID: book.author_ID });
        if (!authorExists) {
            return req.error(400, `Author with ID ${book.author_ID} does not exist`);
        }

        const genreExists = await SELECT.one.from(Genres).where({ ID: book.genre_ID });
        if (!genreExists) {
            return req.error(400, `Genre with ID ${book.genre_ID} does not exist`);
        }


        const existingBook = await SELECT.one.from(Books).where({ title: book.title });
        if (existingBook) {
            return req.error(400, `A book with the title '${book.title}' already exists`);
        }

        const result = await INSERT.into(Books).entries(book);
        return result;
    });

    this.on('DELETE', 'Books', async (req) => {
        const { ID } = req.data;

        const result = await DELETE.from(Books).where({ ID: ID });
        if (result === 0) {
            return req.error(404, `Book with ID ${ID} not found`);
        }
    });

    this.on('UPDATE', 'Books', async (req) => {
        const { ID } = req.data;
        const updateData = req.data;

        try {
            const book = await SELECT.one.from(Books).where({ ID: ID });
            if (!book) {
                req.reject(404, `Book with ID ${ID} not found`);
                return;
            }

            // Update only the fields that were sent in the request
            Object.keys(updateData).forEach(key => {
                if (key !== 'ID' && updateData[key] !== undefined) {
                    book[key] = updateData[key];
                }
            });

            // Recalculate final price if price or discount changed
            if (updateData.price !== undefined || updateData.discount !== undefined) {
                book.finalPrice = parseFloat((book.price - (book.price * book.discount / 100)).toFixed(2));
            }

            await UPDATE(Books).set(book).where({ ID: ID });

            return book;
        } catch (error) {
            req.reject(500, `Error updating book: ${error.message}`);
        }
    });

    this.on('register', async (req) => {
        const { username, password, email, firstName, lastName } = req.data;

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return { success: false, message: 'Please enter a valid email address' };
        }

        // Check if username already exists
        const existingUser = await SELECT.from(Users).where({ username: username });
        if (existingUser.length > 0) {
            return { success: false, message: 'Username has already been taken' };
        }

        // Check if email already exists
        const existingEmail = await SELECT.from(Users).where({ email: email });
        if (existingEmail.length > 0) {
            return { success: false, message: 'You are already a user. Please login.' };
        }

        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!passwordRegex.test(password)) {
            return { success: false, message: 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character' };
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create the user with admin set to false
        try {
            await INSERT.into(Users).entries({
                username,
                password: hashedPassword,
                email,
                firstName,
                lastName,
                admin: false  // Set admin to false by default
            });
            return { success: true, message: 'User registered successfully' };
        } catch (error) {
            return { success: false, message: 'Registration failed: ' + error.message };
        }
    });

    this.on('login', async (req) => {
        console.log("Login request received", req.data);
        const { username, password } = req.data;

        const user = await SELECT.one.from(Users).where({ username: username });

        if (!user) {
            return { success: false, message: 'Invalid credentials' };
        }

        let passwordMatch = false;

        if (user.password.startsWith('$2b$') || user.password.startsWith('$2a$')) {
            // The password is hashed, use bcrypt to compare
            passwordMatch = await bcrypt.compare(password, user.password);
        } else {
            // The password is not hashed, compare directly
            passwordMatch = (password === user.password);

            // If the password matches, update it to a hashed version
            if (passwordMatch) {
                const hashedPassword = await bcrypt.hash(password, 10);
                await UPDATE(Users).set({ password: hashedPassword }).where({ username: username });
            }
        }

        if (!passwordMatch) {
            return { success: false, message: 'Invalid credentials' };
        }

        return { success: true, username: user.username, admin: user.admin };
    });


    // this.on('placeOrder', async (req) => {
    //     const { username, items } = req.data;
    //     try {
    //         if (!username || !items || items.length === 0) {
    //             return req.error(400, 'Username and items are required');
    //         }

    //         const db = await cds.connect.to('db');
    //         const orders = db.entities.Orders;
    //         const orderItems = db.entities.OrderItems;
    //         const books = db.entities.Books;

    //         let totalAmount = 0;
    //         let orderItemsToInsert = [];
    //         let booksToUpdate = [];
    //         let bookNames = [];

    //         for (const item of items) {
    //             const book = await db.read(books).where({ ID: item.bookId });
    //             if (book && book.length > 0) {
    //                 const bookData = book[0];
    //                 const price = bookData.price * item.quantity;

    //                 // Add debug statement to verify the price calculation
    //                 console.log(`Book ID: ${item.bookId}, Quantity: ${item.quantity}, Price: ${price}`);

    //                 totalAmount += price;

    //                 orderItemsToInsert.push({
    //                     quantity: item.quantity,
    //                     price: price,
    //                     book_ID: item.bookId,
    //                 });

    //                 booksToUpdate.push({
    //                     ID: item.bookId,
    //                     newStock: bookData.stock - item.quantity
    //                 });

    //                 bookNames.push(bookData.title);
    //             } else {
    //                 return req.error(400, `Book with ID ${item.bookId} not found`);
    //             }
    //         }

    //         // Debug statement to verify the accumulated totalAmount
    //         console.log("Total Amount calculated:", totalAmount);

    //         const orderResult = await db.run(
    //             INSERT.into(orders).entries({
    //                 orderDate: new Date().toISOString(),
    //                 totalAmount: totalAmount,
    //                 status: 'Pending',
    //                 user_username: username,
    //             })
    //         );

    //         for (const orderItem of orderItemsToInsert) {
    //             orderItem.order_ID = orderResult.ID;
    //             await db.run(INSERT.into(orderItems).entries(orderItem));
    //         }

    //         for (const book of booksToUpdate) {
    //             await db.run(
    //                 UPDATE(books)
    //                 .set({ stock: book.newStock })
    //                 .where({ ID: book.ID })
    //             );
    //         }

    //         console.log("Order placed successfully. Returning:", { 
    //             success: true, 
    //             message: 'Order placed successfully', 
    //             orderId: orderResult.ID,
    //             bookNames: bookNames.join(', ')
    //         });

    //         return { 
    //             success: true, 
    //             message: 'Order placed successfully', 
    //             orderId: orderResult.ID || 0,
    //             bookNames: bookNames.join(', ')
    //         };
    //     } catch (error) {
    //         console.error("Error in placeOrder:", error);
    //         return {
    //             success: false,
    //             message: 'Failed to place order: ' + error.message
    //         };
    //     }
    // });

    this.on('placeOrder', async (req) => {
        const { username, items } = req.data;
        try {
            if (!username || !items || items.length === 0) {
                return req.error(400, 'Username and items are required');
            }

            const db = await cds.connect.to('db');
            const orders = db.entities.Orders;
            const orderItems = db.entities.OrderItems;
            const books = db.entities.Books;

            let totalAmount = 0;
            let orderItemsToInsert = [];
            let booksToUpdate = [];
            let bookNames = [];

            for (const item of items) {
                const book = await db.read(books).where({ ID: item.bookId });
                if (book && book.length > 0) {
                    const bookData = book[0];
                    const price = bookData.price * item.quantity;

                    // Add debug statement to verify the price calculation
                    console.log(`Book ID: ${item.bookId}, Quantity: ${item.quantity}, Price: ${price}`);

                    totalAmount += price;

                    orderItemsToInsert.push({
                        quantity: item.quantity,
                        price: price,
                        book_ID: item.bookId,
                    });

                    booksToUpdate.push({
                        ID: item.bookId,
                        newStock: bookData.stock - item.quantity
                    });

                    bookNames.push(bookData.title);
                } else {
                    return req.error(400, `Book with ID ${item.bookId} not found`);
                }
            }

            // Debug statement to verify the accumulated totalAmount
            console.log("Total Amount calculated:", totalAmount);

            // Insert the order
            await db.run(
                INSERT.into(orders).entries({
                    orderDate: new Date().toISOString(),
                    totalAmount: totalAmount,
                    status: 'Pending',
                    user_username: username,
                })
            );

            // Retrieve the latest inserted order ID
            const latestOrder = await db.read(orders)
                .orderBy({ ID: 'desc' })
                .where({ user_username: username })
                .limit(1);

            if (latestOrder.length === 0) {
                return req.error(500, 'Failed to retrieve the order ID');
            }

            const orderId = latestOrder[0].ID;

            // Update the orderItems with the correct order_ID and insert them
            for (const orderItem of orderItemsToInsert) {
                orderItem.order_ID = orderId;
                await db.run(INSERT.into(orderItems).entries(orderItem));
            }

            // Update the book stock
            for (const book of booksToUpdate) {
                await db.run(
                    UPDATE(books)
                        .set({ stock: book.newStock })
                        .where({ ID: book.ID })
                );
            }

            console.log("Order placed successfully. Returning:", {
                success: true,
                message: 'Order placed successfully',
                orderId: orderId,
                bookNames: bookNames.join(', ')
            });

            return {
                success: true,
                message: 'Order placed successfully',
                orderId: orderId || 0,
                bookNames: bookNames.join(', ')
            };
        } catch (error) {
            console.error("Error in placeOrder:", error);
            return {
                success: false,
                message: 'Failed to place order: ' + error.message
            };
        }
    });




    this.on('updateOrderStatus', async (req) => {
        const { orderId, newStatus } = req.data;
        try {
            const order = await SELECT.one.from(Orders).where({ ID: orderId });
            if (!order) {
                return { success: false, message: `Order with ID ${orderId} not found` };
            }
            await UPDATE(Orders).set({ status: newStatus }).where({ ID: orderId });
            return { success: true, message: 'Order status updated successfully' };
        } catch (error) {
            req.reject(500, `Error updating order status: ${error.message}`);
        }
    });



    this.on('cancelOrder', async (req) => {
        const { orderId } = req.data;

        const order = await SELECT.one.from(Orders).where({ ID: orderId });
        if (!order) {
            return req.error(404, `Order with ID ${orderId} not found`);
        }

        if (order.status !== 'Pending') {
            return req.error(400, `Order with ID ${orderId} cannot be canceled`);
        }

        const orderItems = await SELECT.from(OrderItems).where({ order_ID: orderId });

        // Restore stock for each item
        for (const item of orderItems) {
            await UPDATE(Books)
                .set({ stock: { '+=': item.quantity } })
                .where({ ID: item.book_ID });
        }

        // Update order status to 'Canceled'
        await UPDATE(Orders)
            .set({ status: 'Canceled' })
            .where({ ID: orderId });

        return { success: true, message: 'Order canceled successfully' };
    });

    this.on('fetchOrderHistory', async (req) => {
        const { bookId, username } = req.data;

        console.log(req.data);

        if (!bookId || !username) {
            return { success: false, message: 'bookId and username are required' };
        }

        try {

            // const orders = await SELECT
            //     .from('my.bookshop.Orders')
            //     .where({ user_username: username });

            // console.log("orders: ", orders);

            // // Then, get the order items for the specific book
            // const orderItems = await SELECT
            //     .from('my.bookshop.OrderItems')
            //     .where({ book_ID: bookId });

            // console.log("orderItems: ", orderItems);

            // // Fetch book title
            // const book = await SELECT.one
            //     .from('my.bookshop.Books')
            //     .where({ ID: bookId })
            //     .columns(['title']);

            // console.log("book: ", book);


            // Fetch orders and corresponding order items where both username and bookId match

            const orderDetails = await SELECT.from('my.bookshop.OrderItems as oi')
                .join('my.bookshop.Orders as o').on('oi.order_ID = o.ID')
                .join('my.bookshop.Books as b').on('oi.book_ID = b.ID')
                .where({ 'o.user_username': username, 'oi.book_ID': bookId })
                .columns([
                    'o.ID as orderId',
                    'b.title as bookName',
                    'oi.quantity as quantity',
                    'oi.price as price',
                    'o.status as status'
                ]);

            console.log("orderDetails: ", orderDetails);

            // if (orderDetails.length === 0) {
            //     return { success: false, message: 'No orders found for the given book and user.' };
            // }

            // Aggregate the data to get total price and total quantity per order
            const aggregatedOrderDetails = orderDetails.map(order => ({
                id: order.orderId,
                bookName: order.bookName,
                totalPrice: order.quantity * order.price,
                totalQuantity: order.quantity,
                status: order.status
            }));

            // Return the aggregated order details
            return {
                success: true,
                orderHistory: aggregatedOrderDetails
            };
        } catch (error) {
            console.error('Error fetching order history:', error);
            return { success: false, message: 'Error fetching order history: ' + error.message };
        }
    });

    // this.on('fetchOrderHistory', async (req) => {
    //     const { bookId, username } = req.data;

    //     console.log(req.data);

    //     if (!bookId || !username) {
    //         return { success: false, message: 'bookId and username are required' };
    //     }

    //     try {
    //         // Fetch orders for the user
    //         const orders = await SELECT
    //             .from('my.bookshop.Orders')
    //             .where({ user_username: username });

    //         console.log("orders: ", orders);

    //         // Fetch order items for the specific book
    //         const orderItems = await SELECT
    //             .from('my.bookshop.OrderItems')
    //             .where({ book_ID: bookId });

    //         console.log("orderItems: ", orderItems);

    //         // Fetch book title
    //         const book = await SELECT.one
    //             .from('my.bookshop.Books')
    //             .where({ ID: bookId })
    //             .columns(['title']);

    //         const bookName = book ? book.title : 'Unknown';

    //         // Map orders to include total price, total quantity, and status
    //         const orderDetails = orders.map(order => {
    //             // Filter order items for the current order ID
    //             const itemsForOrder = orderItems.filter(item => item.order_ID === order.ID);

    //             // Calculate total price and total quantity
    //             const totalQuantity = itemsForOrder.reduce((sum, item) => sum + item.quantity, 0);
    //             const totalPrice = itemsForOrder.reduce((sum, item) => sum + (item.quantity * item.price), 0);

    //             return {
    //                 id: order.ID,
    //                 bookName: bookName,
    //                 totalPrice: totalPrice,
    //                 totalQuantity: totalQuantity,
    //                 status: order.status
    //             };
    //         }).filter(order => order.totalQuantity > 0); // Ensure that only orders with relevant items are included

    //         console.log("orderDetails: ", orderDetails);

    //         // Return the aggregated order details
    //         return {
    //             success: true,
    //             orderHistory: orderDetails
    //         };
    //     } catch (error) {
    //         console.error('Error fetching order history:', error);
    //         return { success: false, message: 'Error fetching order history: ' + error.message };
    //     }
    // });

});

