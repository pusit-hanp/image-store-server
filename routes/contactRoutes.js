import express from 'express';
import nodemailer from 'nodemailer';

const router = express.Router();

const mailSetUp = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'imagecapstone@gmail.com',
        pass: process.env.EMAIL_PASSWORD_NODEMAILER,
    },
    fetch: {
        timeout: 60000,
    },
});
router.post('/', async (req, res) => {
    const name = req.body.name;
    const email = req.body.email;
    const mobile = req.body.mobile;
    const comments = req.body.comments;

    const mailDataCompany = {
        from: 'imagecapstone@gmail.com',
        to: 'imagecapstone@gmail.com',
        subject: 'Website Contact',
        html: `<p>Name: ${name}</p>
               <p>Email: ${email}</p>
               <p>Phone number: ${mobile}</p>
               <p>Message: ${comments.replace(/\r\n|\r|\n/g, '<br>')}</p>`,
    };

    const mailDataUser = {
        from: 'imagecapstone@gmail.com',
        to: `${email}`,
        subject: 'Website Contact',
        html: `<p><b>This is a copy of the email sent via the contact form</b><br><br></p>
               <p>Name: ${name}</p>
               <p>Email: ${email}</p>
               <p>Phone number: ${mobile}</p>
               <p>Message: ${comments.replace(/\r\n|\r|\n/g, '<br>')}</p>`,
    };

    try {
        mailSetUp.sendMail(mailDataCompany, function (error, info) {
            if (error) {
                console.log('Email error');
                console.log(error);
            } else {
                console.log('Email response: ' + info.response);
            }
        });

        mailSetUp.sendMail(mailDataUser, function (error, info) {
            if (error) {
                console.log('Email error');
                console.log(error);
            } else {
                console.log('Email response: ' + info.response);
            }
        });
        res.send();
    } catch (errorMail) {
        console.log(errorMail);
    }
})

export default router;