const { EventEmitter } = require('events');

class DomainEventBus extends EventEmitter {
    emitDomain(eventName, payload = {}) {
        const event = {
            name: eventName,
            payload,
            emittedAt: new Date()
        };

        setImmediate(() => {
            this.emit(eventName, event);
            this.emit('*', event);
        });
    }
}

module.exports = new DomainEventBus();
