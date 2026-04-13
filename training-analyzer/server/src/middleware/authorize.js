/**
 * Factory middleware: verifica che la risorsa appartenga all'utente autenticato.
 * Usa dopo authenticate. Controlla req.resource.userId oppure req.params[paramName].
 *
 * Uso tipico nelle route:
 *   router.put('/:id', authenticate, loadResource, authorize(), controller.update)
 */
function authorize(ownerField = 'userId') {
  return (req, res, next) => {
    // If a resource was loaded onto req.resource, check its owner
    if (req.resource) {
      if (req.resource[ownerField] !== req.user.uid) {
        return res.status(403).json({ error: { message: 'Forbidden' } });
      }
      return next();
    }

    // Fallback: check URL param
    if (req.params.uid && req.params.uid !== req.user.uid) {
      return res.status(403).json({ error: { message: 'Forbidden' } });
    }

    next();
  };
}

module.exports = authorize;
