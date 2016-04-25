var nodemailer = require('nodemailer');


// create reusable transporter object using the default SMTP transport
var transporter = nodemailer.createTransport('smtps://' + process.env.EMAIL_USER + '%40gmail.com:' + process.env.EMAIL_USER_PASS + '@smtp.gmail.com');


exports.sendEmail = function sendEmail(toEmail, subject, text, cb) {
    console.log("sending email to " + email+" subject:"+subject);

    // setup e-mail data with unicode symbols
    var mailOptions = {
        from: '"Lead Dragon" <worker@lead-dragon.com>', // sender address
        to: ['paddy.iitr@gmail.com', toEmail], // list of receivers
        subject: subject, // Subject line
        text: text
    };

    // send mail with defined transport object
    transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
            return console.log(error);
        }
        console.log('Message sent: ' + info.response);
    });
}
