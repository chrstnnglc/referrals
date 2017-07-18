$(function () {
  var $card = {
    name: $('.card-name'),
    number: $('.card-number').payment('formatCardNumber'),
    expiry: $('.card-expiry').payment('formatCardExpiry'),
    cvc: $('.card-cvc').payment('formatCardCVC')
  }

  $card.number.keyup(function () {
    var cardType = $.payment.cardType($('.card-number').val())
    if (cardType !== null) {
      $('.cc-image').css('background-image', 'url(static/images/' + cardType + '.png)')
    }
  })

  $card.number
  .on('blur', function () {
    $card.number.toggleClass('no-bg', $card.number.val().length > 0)
  })
  .on('focus', function () {
    $card.number.addClass('no-bg')
  })

  var $form = $('.cc-form')

  $form.on('submit', function (e) {
    e.preventDefault()

    if (stripeToken) {
      $form.find('input[name=stripe_token]').val(JSON.stringify(stripeToken))
      $form.attr('action', '')
      $form.get(0).submit()
      return
    }

    var $btn = $form.find('.btn-buy')
    var $messages = $('.messages')
    var expiry = $card.expiry.payment('cardExpiryVal')

    Stripe.card.createToken({
      name: $card.name.val(),
      number: $card.number.val(),
      exp_month: expiry.month,
      exp_year: expiry.year,
      cvc: $card.cvc.val()
    }, function (status, resp) {
      if (resp.error) {
        $messages.empty().append(
        $('<p>')
          .text(resp.error.message)
          .addClass('error')
      )
        $btn
        .text('Buy with Card')
        .prop('disabled', false)
      } else {
        $form.find('input[name=stripe_token]').val(JSON.stringify(resp))
        $form.get(0).submit()
      }
    })

  // Disabled buy button while creating Stripe token
    $btn
    .text('Processing...')
    .prop('disabled', true)
  })

  $('.nav-tabs li a').click(function (e) {
    window.location.hash = e.target.href.split('#')[1]
  })
})

if (location.hash) {
  setTimeout(function () {
    window.scrollTo(0, 0)
  }, 1)
}

$('.paypal-form').on('submit', function (e) {
  $('.paypal-form .btn-buy').text('Processing...').prop('disabled', true)
})
