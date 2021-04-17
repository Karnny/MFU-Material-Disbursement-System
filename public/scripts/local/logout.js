function init() {
    gapi.load('auth2', () => {
        gapi.auth2.init({
            client_id: '937572142445-jhdtq28bgrjtvkm7efsljbjkbfvp46f4.apps.googleusercontent.com'
        });
    });
}

function signOut() {
    const auth2 = gapi.auth2.getAuthInstance();
    auth2.signOut().then(() => {
        window.location.replace('/logout');
    });
}