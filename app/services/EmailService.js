var nodemailer = require('nodemailer');
var log4js = require('log4js');
var logger = log4js.getLogger('leaddragon');

// create reusable transporter object using the default SMTP transport
var transporter = nodemailer.createTransport('smtps://' + process.env.EMAIL_USER + '%40gmail.com:' + process.env.EMAIL_USER_PASS + '@smtp.gmail.com');


exports.sendEmail = function sendEmail(toEmail, subject, text, cb) {
    logger.info("sending email to " + email+" subject:"+subject);
    // setup e-mail data with unicode symbols
    var mailOptions = {
        from: '"Lead Dragon" <noreply@lead-dragon.com>', // sender address
        to: ['data.leaddragon@gmail.com', toEmail], // list of receivers
        subject: subject, // Subject line
        text: text
    };

    // send mail with defined transport object
    transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
            logger.info(error);
            cb(error, null);
            return;
        }
        if(info && info.response){
            logger.info('Message sent: ' + info.response);
            cb(null, info.response);
            return;
        }
        cb("Response not received for sent email",null);
    });
}
