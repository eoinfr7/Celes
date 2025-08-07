class NotificationService {
  constructor() {
    this.notificationContainer = document.getElementById('notification-container');
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    notification.innerHTML = `
      <div class="notification-content">${message}</div>
      <button class="notification-close">×</button>
    `;

    this.notificationContainer.appendChild(notification);

    setTimeout(() => notification.classList.add('show'), 100);

    notification.querySelector('.notification-close').addEventListener('click', () => {
      this.hideNotification(notification);
    });

    setTimeout(() => {
      if (notification.parentNode) {
        this.hideNotification(notification);
      }
    }, 5000);
  }

  hideNotification(notification) {
    notification.classList.remove('show');
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = NotificationService;
} else {
  window.NotificationService = NotificationService;
}