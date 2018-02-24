import jwt from 'jsonwebtoken';
import model from '../db/models/index';
import logger from '../logger';

const User = model.users;
const AuthToken = model.authTokens;

module.exports = {
  // helper functions
  sendResult(res, result) {
    return res.status(200).json(result);
  },
  sendError(res, errorMessage, responseCode = 500) {
    return res.status(responseCode).json(errorMessage);
  },
  /**
   * validate user using jwt
   * @param {*} req - client request
   * @param {*} res - server response
   * @param {*} next - call the next route
   * @returns {object} -
   */
  validateUser(req, res, next) {
    if (!req.headers && !req.body && !req.query) {
      // if there is no data to process
      res.status(401).send({
        message: 'Session has expired, please signin',
      });
    }
    const token = req.headers.authorization || req.body.token || req
      .query.token;
    // decoding the token
    if (token) {
      jwt.verify(token, process.env.SECRET_KEY, (error, decoded) => {
        if (error) {
          res.status(401).send({
            message: 'Failed to authenticate token.',
          });
          return;
        }
        // check if user is disable
        User
          .find({
            where: {
              id: decoded.userId,
            },
          })
          .then((foundUser) => {
            if (foundUser) {
              // react to user status
              const accountStatus = foundUser.status;
              switch (accountStatus) {
                case 'disabled':
                  res.status(401).send({
                    message: 'This account is blocked, Please contact the admin',
                  });
                  break;
                case 'inactive':
                  res.status(401).send({
                    message: 'This account does not exist',
                  });
                  break;
                case 'active':
                  // attach user info to the request object
                  /* eslint-disable no-param-reassign */
                  req.user = decoded;
                  next();
                  break;
                default:
                  res.status(401).send({
                    message: 'Invalid operation, check your credentials'
                  });
              }
              return;
            }
            res.status(401).send({
              message: 'Wrong authentication credentials, ' +
            'please signin/signup again',
            });
          })
          .catch(err => res.status(500).send({
            message: `Error occurred, please try again: ${err.message}`,
          }));
      });
    } else {
      // if there is no token available return a message
      res.status(401).send({ message: 'No token provided.' });
    }
  },
  /**
  * validate admin user using jwt
  * @param {*} req - client request
  * @param {*} res - server response
  * @param {*} next - call the next route
  * @returns {object} -
  */
  adminPass(req, res, next) {
    if (req.user.user_category !== 'admin') {
      res.status(401).send({
        message: 'Wrong authentication credentials, ' +
      'please signin/signup again',
      });
    }
    next();
  },
  storeAuthToken(userId, selector) {
    const today = new Date();
    const expires = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + 7,
    );
    const newAuthTokenObj = {
      selector,
      userId,
      hashedValidator: 'placeholder',
      expires,
    };

    // delete existing token
    AuthToken.destroy({
      where: {
        userId,
      },
    })
      .then(() => {
        AuthToken.create(newAuthTokenObj)
          .then(() => selector)
          .catch((err) => {
            logger.error('An error occurred', err);
            return null;
          });
      })
      .catch(() => null);
  },
};

