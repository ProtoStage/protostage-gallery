/**
 * app.js — Main prototype flow definition.
 */
document.addEventListener('DOMContentLoaded', function () {
  // Define screens
  var steps = [
    {
      id: 'home',
      label: 'Home Dashboard',
      mount: { title: 'Prototype Studio', showBack: false, activeTab: 'home' },
      content: function () {
        return `
          <div class="card">
            <h2 class="card-title">Welcome to ProtoStage ✨</h2>
            <p class="card-desc">An open platform for agentic mobile and web flow prototyping.</p>
            <button class="btn" data-goto="checkout">Start Checkout Flow →</button>
          </div>

          <div class="card">
            <h3 class="card-title">Interactive Capabilities</h3>
            <p class="card-desc">Try turning on scenarios with the bottom-left switcher, or leave a review comment with the bottom-right button.</p>
            <button class="btn btn-secondary" data-goto="explore">Explore Patterns</button>
          </div>
        `;
      }
    },
    {
      id: 'explore',
      label: 'Pattern Explorer',
      mount: { title: 'Explore', showBack: true, activeTab: 'explore' },
      content: function () {
        return `
          <div class="card">
            <h2 class="card-title">Design Patterns</h2>
            <p class="card-desc">Browse pre-composed components, layout primitives, and navigation stacks.</p>
            <button class="btn btn-secondary" data-goto="home">← Back Home</button>
          </div>
        `;
      }
    },
    {
      id: 'checkout',
      label: 'Order Checkout',
      mount: { title: 'Review Order', showBack: true, hideFooter: true },
      content: function () {
        return `
          <div class="card">
            <h2 class="card-title">Order Summary</h2>
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px;">
              <span>ProtoStage Pro Subscription</span>
              <strong>$19.00</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 16px; font-size: 14px; color: var(--color-text-muted);">
              <span>Estimated Tax</span>
              <span>$1.52</span>
            </div>
            <div style="border-top: 1px solid var(--color-border); padding-top: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; font-size: 16px; font-weight: bold;">
              <span>Total</span>
              <span>$20.52</span>
            </div>
            <button class="btn" data-goto="confirmation">Confirm & Pay</button>
            <div style="margin-top: 10px;">
              <button class="btn btn-secondary" data-back="true">Cancel</button>
            </div>
          </div>
        `;
      }
    },
    {
      id: 'confirmation',
      label: 'Order Confirmed',
      mount: { title: 'Success', showBack: false, hideFooter: false, activeTab: 'home' },
      content: function () {
        return `
          <div class="card" style="text-align: center; padding: 32px 16px;">
            <div style="font-size: 48px; margin-bottom: 16px;">🎉</div>
            <h2 class="card-title">Order Placed!</h2>
            <p class="card-desc">Your prototype order was processed successfully.</p>
            <button class="btn" data-goto="home">Return Home</button>
          </div>
        `;
      }
    }
  ];

  // Options & error scenarios
  var options = {
    conditions: {
      'card-declined': {
        label: 'Card Declines on Checkout',
        replace: {
          'confirmation': {
            label: 'Payment Declined',
            mount: { title: 'Payment Failed', showBack: true, hideFooter: true },
            content: function () {
              return `
                <div class="alert-box alert-danger">
                  <strong>Payment Failed:</strong> Your card issuer declined this transaction. Please update your payment method.
                </div>
                <div class="card">
                  <h3 class="card-title">Retry Payment</h3>
                  <p class="card-desc">Select a different card to complete your order.</p>
                  <button class="btn" data-goto="checkout">Try Again</button>
                </div>
              `;
            }
          }
        }
      }
    }
  };

  // Initialize router
  window.FlowRouter.init(steps, options);
});
