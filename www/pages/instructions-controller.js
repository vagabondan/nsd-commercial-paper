/**
 * @class InstructionsController
 * @classdesc
 * @ngInject
 */
function InstructionsController($scope, InstructionService, BookService, DialogService, ConfigLoader /*, SocketService*/) {

  var ctrl = this;
  ctrl.list = [];

  // var DATE_INPUT_FORMAT = 'dd/mm/yyyy';
  var DATE_FABRIC_FORMAT = 'yyyy-mm-dd'; // ISO
  var TRANSFER_SIDE_TRANSFERER = 'transferer';
  var TRANSFER_SIDE_RECEIVER = 'receiver';


  ctrl.org = ConfigLoader.get().org;

  // ConfigLoader.getAccount(orgID)
  ctrl.accountFrom = null;
  ctrl.accountTo   = null;


  /**
   *
   */
  ctrl.init = function(){
      $scope.$on('chainblock', function(e, block){
        if( InstructionService.isBilateralChannel(block.getChannel()) ){
          ctrl.reload();
        }
      });
      ctrl.reload();
  }

  /**
   *
   */
  ctrl.reload = function(){
    ctrl.invokeInProgress = true;
    return InstructionService.listAll()
      .then(function(list){
        ctrl.list = list;
      })
      .finally(function(){
        ctrl.invokeInProgress = false;
      });
  }


  /**
   * @return {Instruction}
   */
  ctrl._getDefaultInstruction = function(transferSide, opponentID){
    var orgID = ctrl.org;
    return {
      deponentFrom: ctrl._getDeponentCode(transferSide == TRANSFER_SIDE_TRANSFERER ? orgID : opponentID),
      deponentTo:   ctrl._getDeponentCode(transferSide == TRANSFER_SIDE_RECEIVER ? orgID : opponentID),

      initiator: transferSide,
      // quantity: 0, // TODO: cause ui bug with overlapping label and input field with value
      tradeDate    : new Date(),//.format(DATE_INPUT_FORMAT),
      instructionDate : new Date(),//.format(DATE_INPUT_FORMAT),
      reason:{
        created   : new Date()//.format(DATE_INPUT_FORMAT)
      }
    };
  }

  ctrl._getDeponentCode = function(orgID){
    var account = ConfigLoader.getAccount(orgID) || {};
    return account.dep;
  }

  /**
   *
   */
  ctrl.getStatusClass = function(status){
    switch(status){
      case 'matched' : return 'deep-purple-text';
      case 'declined': return 'red-text darken-4';
      case 'executed': return 'green-text darken-4';
      case 'canceled': return 'grey-text';
      default: return '';
    }
  }



  ctrl.cancelInstruction = function(instruction){

    return DialogService.confirm( 'Cancel '+instruction.deponentFrom+' -> '+instruction.deponentTo+' ?', {yesTitle:'Cancel it', yesKlass:'red white-text'})
      .then(function(isConfirmed){
        if(isConfirmed){
          ctrl.invokeInProgress = true;
          return InstructionService.cancelInstruction(instruction)
            .finally(function(){
              ctrl.invokeInProgress = false;
            });
        }
      })

  }


  /**
   *
   */
  ctrl.newInstructionTransfer = function(transferSide, _channel){
    if(!$scope.inst || $scope.inst.initiator != transferSide){
        // preset values

        var opponentOrgID = ctrl._getOrgIDByChannel(_channel);
        $scope.inst = ctrl._getDefaultInstruction(transferSide, opponentOrgID);

        // preset
        ctrl._fillAccount(transferSide, opponentOrgID);
    }
  };

  ctrl._fillAccount = function(transferSide, opponentID){
    if(transferSide == TRANSFER_SIDE_TRANSFERER){
      ctrl.accountFrom = ConfigLoader.getAccount(ctrl.org);
      ctrl.accountTo = opponentID ? ConfigLoader.getAccount(opponentID) : null;
    } else {
      ctrl.accountFrom = opponentID ? ConfigLoader.getAccount(opponentID) : null;
      ctrl.accountTo = ConfigLoader.getAccount(ctrl.org);
    }
  };



  /**
   *
   */
  ctrl._getOrgIDByChannel = function(channelID){
    if(!channelID) return null;
    return channelID.split('-').filter(function(org){ return org != ctrl.org; })[0];
  }

  /**
   *
   */
  ctrl.sendInstruction = function(instruction){

    // FIXME here date can come in two different formats:
    //  Date object when we change form value
    //  String (like '1 August, 2017') when we not change form value
    // Now we use formatDate() to transform both of it into ISO
    instruction.tradeDate        = formatDate(instruction.tradeDate);
    instruction.instructionDate  = formatDate(instruction.instructionDate);
    instruction.reason.created   = formatDate(instruction.reason.created);

    var p;
    switch(instruction.initiator){
      case TRANSFER_SIDE_TRANSFERER:
        p = InstructionService.transfer(instruction);
        break;
      case TRANSFER_SIDE_RECEIVER:
        p = InstructionService.receive(instruction);
        break;
      default:
        throw new Error('Unknpown transfer side: ' + instruction.initiator);
    }


    ctrl.invokeInProgress = true;
    return p.then(function(){
      $scope.inst = null;
    })
    .finally(function(){
      ctrl.invokeInProgress = false;
    });
  };

  /**
   * Parse date in format dd/mm/yyyy
   * @param {string|Date} dateStr
   * @return {Date}
   */
  function formatDate(date){
    if(!date) return null;

    if(!(date instanceof Date)){
      // assumind date is a string: '1 August, 2017'
      // TODO: we shouldn't rely on this
      date = new Date(date);
    }
    return date.format(DATE_FABRIC_FORMAT);
  }


  /**
   *
   */
  ctrl.newRedemption = function(){
    $scope.redemption = $scope.redemption || ctrl._getDefaultRedemption();
  }
  /**
   * @return {Redemption}
   */
  ctrl._getDefaultRedemption = function(){
    return {
      reason:{
        created   : new Date()//.format(DATE_INPUT_FORMAT)
      }
    };
  }

  /**
   * @param {Redemption} redemption
   */
  ctrl.sendRedemption = function(redemption){
    return DialogService.confirm( 'Redeem '+redemption.security+' ?', {yesTitle:'Yes, redeem it', yesKlass:'red white-text'})
      .then(function(isConfirmed){
        if(isConfirmed){
          return BookService.redeem(redemption);
        }
      })
      .then(function(){
        $scope.redemption = null;
      });
  }


  /**
   * @param {Instruction} instruction
   */
  ctrl.showHistory = function(instruction){
    return InstructionService.history(instruction)
      .then(function(result){
        var scope = {history: result, getStatusClass: ctrl.getStatusClass};
        return DialogService.dialog('balance-history.html', scope);
      });
  }


  ctrl.getStub = function(transferSide){
    return {
      deponentFrom: 'CA9861913023',
      deponentTo:   'DE000DB7HWY7',

      security:'RU000ABC0001',
      transferer:{
        account: "902",
        division: "05",
      },
      receiver:{
        account: "903",
        division: "09",
      },
      initiator: transferSide,
      quantity: 1,
      reference: 'test',
      tradeDate    : new Date(),//.format(DATE_INPUT_FORMAT),
      instructionDate : new Date(),//.format(DATE_INPUT_FORMAT),
      reason:{
        created   : new Date()//.format(DATE_INPUT_FORMAT)
      }
    };
  }



  //////////////

  // INIT
  ctrl.init();

}

angular.module('nsd.controller.instructions', ['nsd.service.instructions'])
.controller('InstructionsController', InstructionsController);