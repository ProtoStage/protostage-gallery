/**
 * flow-router.js — Multi-screen flow routing & scenario switching engine.
 *
 * Drives interactive multi-screen flows: STEPS[] + history stack.
 * Integrates with window.AppShell or directly mounts into `#content-slot`.
 *
 * Usage:
 *   FlowRouter.init([
 *     { id: "cart", label: "Shopping Cart", content: () => renderCart() },
 *     { id: "checkout", label: "Checkout", content: () => renderCheckout() }
 *   ], {
 *     conditions: {
 *       "declined": {
 *         label: "Payment declines",
 *         insert: { after: "checkout", steps: [ { id: "error", label: "Payment Error", content: () => renderDeclined() } ] }
 *       }
 *     }
 *   });
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FlowRouter = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var _baseSteps = [];
  var _activeSteps = [];
  var _conditionsConfig = {};
  var _activeConditions = {};
  var _currentIndex = 0;
  var _history = [];

  function _recomputeSteps() {
    var result = _baseSteps.slice();

    // 1. Process replacements
    for (var condKey in _activeConditions) {
      if (!_activeConditions[condKey]) continue;
      var cond = _conditionsConfig[condKey];
      if (cond && cond.replace) {
        for (var targetId in cond.replace) {
          var repIndex = result.findIndex(function (s) { return s.id === targetId; });
          if (repIndex !== -1) {
            result[repIndex] = Object.assign({}, result[repIndex], cond.replace[targetId]);
          }
        }
      }
    }

    // 2. Process insertions
    for (var condKey in _activeConditions) {
      if (!_activeConditions[condKey]) continue;
      var cond = _conditionsConfig[condKey];
      if (cond && cond.insert && cond.insert.after && Array.isArray(cond.insert.steps)) {
        var afterId = cond.insert.after;
        var idx = result.findIndex(function (s) { return s.id === afterId; });
        if (idx !== -1) {
          var before = result.slice(0, idx + 1);
          var after = result.slice(idx + 1);
          result = before.concat(cond.insert.steps).concat(after);
        }
      }
    }

    _activeSteps = result;
  }

  function _renderCurrentStep() {
    if (_currentIndex < 0 || _currentIndex >= _activeSteps.length) {
      return;
    }

    var step = _activeSteps[_currentIndex];

    // If AppShell exists, call mount/update
    if (window.AppShell && typeof window.AppShell.mount === 'function') {
      if (step.mount) {
        window.AppShell.mount(step.mount);
      }
      if (typeof step.content === 'function') {
        window.AppShell.setContent(step.content());
      }
    } else {
      // Fallback: inject directly into content slot or body
      var slot = document.getElementById('content-slot') || document.querySelector('.device-frame__screen');
      if (slot && typeof step.content === 'function') {
        var content = step.content();
        if (typeof content === 'string') {
          slot.innerHTML = content;
        } else if (content instanceof HTMLElement) {
          slot.innerHTML = '';
          slot.appendChild(content);
        }
      }
    }

    // Scroll screen back to top on navigation
    var screen = document.querySelector('.device-frame__screen');
    if (screen) {
      screen.scrollTop = 0;
    }

    // Dispatch custom event for stage toolbar or annotations
    window.dispatchEvent(new CustomEvent('stage:stepchange', {
      detail: {
        step: step,
        index: _currentIndex,
        total: _activeSteps.length,
        canGoBack: _history.length > 0
      }
    }));
  }

  function _attachEventListeners() {
    document.addEventListener('click', function (e) {
      // Step navigation: [data-goto="step-id"]
      var gotoTarget = e.target.closest('[data-goto]');
      if (gotoTarget) {
        e.preventDefault();
        var targetId = gotoTarget.getAttribute('data-goto');
        FlowRouter.goTo(targetId);
        return;
      }

      // Back navigation: [data-back]
      var backTarget = e.target.closest('[data-back]');
      if (backTarget) {
        e.preventDefault();
        FlowRouter.back();
        return;
      }

      // Condition toggle: [data-condition="cond-key"]
      var condTarget = e.target.closest('[data-condition]');
      if (condTarget) {
        var condKey = condTarget.getAttribute('data-condition');
        FlowRouter.toggleCondition(condKey);
        return;
      }
    });
  }

  var FlowRouter = {
    init: function (steps, options) {
      options = options || {};
      _baseSteps = steps || [];
      _conditionsConfig = options.conditions || {};
      _activeConditions = {};
      _history = [];
      _currentIndex = 0;

      _recomputeSteps();
      _renderCurrentStep();
      _attachEventListeners();

      return this;
    },

    goTo: function (stepId) {
      var targetIdx = _activeSteps.findIndex(function (s) { return s.id === stepId; });
      if (targetIdx !== -1 && targetIdx !== _currentIndex) {
        _history.push(_currentIndex);
        _currentIndex = targetIdx;
        _renderCurrentStep();
      }
    },

    next: function () {
      if (_currentIndex < _activeSteps.length - 1) {
        _history.push(_currentIndex);
        _currentIndex++;
        _renderCurrentStep();
      }
    },

    back: function () {
      if (_history.length > 0) {
        _currentIndex = _history.pop();
        _renderCurrentStep();
      }
    },

    toggleCondition: function (key, forceState) {
      if (!_conditionsConfig[key]) return;
      var current = !!_activeConditions[key];
      var nextState = typeof forceState === 'boolean' ? forceState : !current;
      _activeConditions[key] = nextState;

      var currentStepId = _activeSteps[_currentIndex] ? _activeSteps[_currentIndex].id : null;
      _recomputeSteps();

      // Maintain current screen if still present
      if (currentStepId) {
        var newIdx = _activeSteps.findIndex(function (s) { return s.id === currentStepId; });
        _currentIndex = newIdx !== -1 ? newIdx : 0;
      } else {
        _currentIndex = 0;
      }

      _renderCurrentStep();

      window.dispatchEvent(new CustomEvent('stage:conditionchange', {
        detail: {
          key: key,
          active: nextState,
          all: Object.assign({}, _activeConditions)
        }
      }));
    },

    isConditionActive: function (key) {
      return !!_activeConditions[key];
    },

    getConditions: function () {
      return _conditionsConfig;
    },

    getActiveConditions: function () {
      return Object.assign({}, _activeConditions);
    },

    getCurrentStep: function () {
      return _activeSteps[_currentIndex];
    },

    getSteps: function () {
      return _activeSteps.slice();
    }
  };

  return FlowRouter;
});
