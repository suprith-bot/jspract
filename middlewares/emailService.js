const { 
    SESClient, 
    CreateTemplateCommand, 
    UpdateTemplateCommand, 
    SendTemplatedEmailCommand 
  } = require("@aws-sdk/client-ses");
  
  // Initialize SES client
  const sesClient = new SESClient({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  });
  

 

  
  // Send email using the template
  const sendResetEmail = async (emailAddress, resetUrl) => {
    const params = {
      Source: process.env.EMAIL_USER,
      Destination: {
        ToAddresses: [emailAddress]
      },
      Template: "PasswordResetTemplate",
      TemplateData: JSON.stringify({ resetUrl: resetUrl })
    };
  
    try {
      const command = new SendTemplatedEmailCommand(params);
      await sesClient.send(command);
      console.log('Password reset email sent successfully');
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  };
  
  module.exports = {
   
    sendResetEmail
  };    
