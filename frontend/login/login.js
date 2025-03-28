document.getElementById("login-form").addEventListener("submit", async function (e) {
    e.preventDefault();
    
    const errorMessage = document.getElementById("error-message");
    errorMessage.textContent = ""; 
    
    try {
        const oyutan = document.getElementById("oyutan").value.trim();
        const password = document.getElementById("password").value.trim();
        
        const response = await fetch("http://127.0.0.1:5000/login", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ oyutan, password }),
        });
        
        const data = await response.json();
        
        if (response.ok) {
            localStorage.setItem('userName', data.name);
            alert(`Welcome, ${data.name}`);
            window.location.href = "../chatbot/chatbot.html";  
        } else {
            errorMessage.textContent = data.message || "Login failed";
        }
    } catch (error) {
        console.error('Login error:', error);
        errorMessage.textContent = "An error occurred during login. Please try again.";
    }
});