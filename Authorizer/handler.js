// Authorizer function
exports.authorizer = async (event) => {
    const validApiKeys = ["abc"]; 
  
    // Extract API key from the headers
    const apiKey = event.authorizationToken;
  
    if (!apiKey) {
      return generatePolicy("Deny", event.methodArn, "Unauthorized: Missing API Key");
    }
  
    if (!validApiKeys.includes(apiKey)) {
      return generatePolicy("Deny", event.methodArn, "Unauthorized: Invalid API Key");
    }
  
    return generatePolicy("Allow", event.methodArn, "Authorized");
  };
  
  // Example "hello" function (protected by the authorizer)
  exports.hello = async () => {
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Hello, your API key is valid!",
      }),
    };
  };
  
  // Helper function to generate IAM policies
  function generatePolicy(effect, resource, message) {
    return {
      principalId: "apiKeyAuthorizer",
      policyDocument: {
        Version: "2012-10-17",
        Statement: [
          {
            Action: "execute-api:Invoke",
            Effect: effect,
            Resource: resource,
          },
        ],
      },
      context: {
        message,
      },
    };
  }
  