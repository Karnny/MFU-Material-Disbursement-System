

function init() {
    gapi.load('auth2', function () {
        gapi.auth2.init({
            client_id: '937572142445-jhdtq28bgrjtvkm7efsljbjkbfvp46f4.apps.googleusercontent.com'
        });
    });
}

function signIn() {
    let auth2 = gapi.auth2.getAuthInstance();
    auth2.signIn({ scope: 'profile email', prompt: 'select_account' }).then(function (googleUser) {
        // var profile = googleUser.getBasicProfile();
        // console.log("ID: " + profile.getId()); // Don't send this directly to your server!
        // console.log('Full Name: ' + profile.getName());
        // console.log('Given Name: ' + profile.getGivenName());
        // console.log('Family Name: ' + profile.getFamilyName());
        // console.log("Image URL: " + profile.getImageUrl());
        // console.log("Email: " + profile.getEmail());

         // The ID token you need to pass to your backend:
         var id_token = googleUser.getAuthResponse().id_token;
        //  console.log("ID Token: " + id_token);
        $.ajax({
            type: "POST",
            url: "/api/login",
            headers: { 'X-Requested-With': 'XMLHttpRequest' },
            data: { token: id_token },
            success: (response) => {
                // alert(response);
                window.location.replace(response);
            },
            error: (xhr) => {
                alert(xhr.responseText);
            }
        });
    }).catch((err) => {
        console.log(err);
    });
}