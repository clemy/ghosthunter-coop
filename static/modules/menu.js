
/* Menu: Handles the 2D/HTML menu overlay
    expand/collapse menus on click,
    method for showing status/error messages and
    showing/hiding the wait spinner
*/

const MAX_STATUS_ENTRIES = 15;

// menu logic
Array.from(document.getElementsByClassName("expand-click")).forEach(element =>
    element.addEventListener("click", () => {
        element.parentNode.querySelector(".inner-container").classList.toggle("hide");
        element.parentNode.querySelector(".expand-icon").innerText =
            element.parentNode.querySelector(".expand-icon").innerText == '+' ? '-' : '+';
    })
);

function showStatus(text, error = false) {
    const span = document.createElement("span");
    if (error) {
        span.classList.add("error");
    }
    span.innerText = `\n${text}`;
    const status = document.getElementById("status");
    status.appendChild(span);
    while (status.children.length > MAX_STATUS_ENTRIES) {
        status.removeChild(status.firstChild);
    }
}

function showStatusWithColor(textWithColor, color, text) {
    const span1 = document.createElement("span");
    span1.style.color = `rgb(${color[0] * 255},${color[1] * 255},${color[2] * 255})`;
    span1.innerText = `\n${textWithColor}`;
    const span2 = document.createElement("span");
    span2.innerText = `${text}`;
    const status = document.getElementById("status");
    status.appendChild(span1);
    status.appendChild(span2);
    while (status.children.length > MAX_STATUS_ENTRIES) {
        status.removeChild(status.firstChild);
    }
}

showStatus.Severity = { ERROR: true };

function showWait() {
    document.getElementById("wait").classList.remove("hide");
}

function hideWait() {
    document.getElementById("wait").classList.add("hide");
}

export { showStatus, showStatusWithColor, showWait, hideWait };
